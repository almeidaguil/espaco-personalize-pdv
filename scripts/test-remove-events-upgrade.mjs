import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

// Detects a cut that discards historical financial rows or leaves legacy API access.
const ids = {
  user: "06060000-0000-4000-8000-000000000001",
  event: "06060000-0000-4000-8000-000000000002",
  cash: "06060000-0000-4000-8000-000000000003",
  sale: "06060000-0000-4000-8000-000000000004",
};
const mode = process.argv[2];
assert.ok(["seed", "verify"].includes(mode), "Expected seed or verify mode");
const environment = resolveEnvironment();
const apiUrl = new URL(environment.url);
assert.ok(
  ["127.0.0.1", "localhost", "::1", "[::1]"].includes(apiUrl.hostname),
  "Refusing to run the upgrade fixture against a remote Supabase",
);
console.log(`Upgrade fixture local hostname: ${apiUrl.hostname}`);
const client = createClient(apiUrl.toString(), environment.key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

if (mode === "seed") {
  // Refuse the final schema before creating any fixture data.
  for (const [table, columns] of [
    ["events", "id"],
    ["cash_sessions", "event_id"],
    ["sales", "event_id"],
  ]) {
    const { error } = await client.from(table).select(columns).limit(0);
    assert.equal(error, null, "Upgrade seed requires the legacy PR05 schema");
  }
  const { data: user, error: userError } = await client.auth.admin.createUser({
    id: ids.user,
    email: "pr06-upgrade-fixture@local.invalid",
    email_confirm: true,
    password: "Local-pr06-upgrade!Aa1",
    user_metadata: { full_name: "PR06 upgrade fixture" },
  });
  assert.equal(userError, null, "could not create reserved upgrade user");
  assert.equal(user.user.id, ids.user, "upgrade user must use its reserved ID");
  const { error: profileError } = await client
    .from("profiles")
    .select("id")
    .eq("id", ids.user)
    .single();
  assert.equal(profileError, null, "upgrade profile must exist");
  for (const [table, row] of [
    [
      "events",
      {
        id: ids.event,
        name: "PR06 historical fixture",
        starts_at: "2026-09-01T12:00:00Z",
        is_active: false,
        created_by: ids.user,
      },
    ],
    [
      "cash_sessions",
      {
        id: ids.cash,
        event_id: ids.event,
        operator_id: ids.user,
        opening_amount_in_cents: 100,
        status: "closed",
        opened_at: "2026-09-01T12:00:00Z",
        closed_at: "2026-09-01T18:00:00Z",
        closed_by: ids.user,
        counted_amount_in_cents: 1100,
        expected_amount_in_cents: 1100,
        difference_amount_in_cents: 0,
      },
    ],
    [
      "sales",
      {
        id: ids.sale,
        event_id: ids.event,
        cash_session_id: ids.cash,
        operator_id: ids.user,
        status: "completed",
        total_in_cents: 1000,
        completed_at: "2026-09-01T13:00:00Z",
      },
    ],
    [
      "payments",
      {
        sale_id: ids.sale,
        method: "cash",
        amount_in_cents: 1000,
        change_in_cents: 0,
      },
    ],
  ]) {
    const { error } = await client.from(table).insert(row);
    assert.equal(error, null, `could not seed historical ${table}`);
  }
  console.log(`Upgrade seed passed: ${JSON.stringify(ids)}`);
} else {
  await waitForSchemaRemoval();
  const { data: cash, error: cashError } = await client
    .from("cash_sessions")
    .select(
      "id,operator_id,status,opening_amount_in_cents,expected_amount_in_cents",
    )
    .eq("id", ids.cash)
    .single();
  assert.equal(cashError, null, "historical cash must survive upgrade");
  assert.deepEqual(cash, {
    id: ids.cash,
    operator_id: ids.user,
    status: "closed",
    opening_amount_in_cents: 100,
    expected_amount_in_cents: 1100,
  });
  const { data: sale, error: saleError } = await client
    .from("sales")
    .select(
      "id,cash_session_id,operator_id,status,total_in_cents,payments(amount_in_cents)",
    )
    .eq("id", ids.sale)
    .single();
  assert.equal(saleError, null, "historical sale must survive upgrade");
  assert.deepEqual(sale, {
    id: ids.sale,
    cash_session_id: ids.cash,
    operator_id: ids.user,
    status: "completed",
    total_in_cents: 1000,
    payments: [{ amount_in_cents: 1000 }],
  });
  console.log(
    `Upgrade verification passed: cash ${ids.cash}, sale ${ids.sale}`,
  );
}

async function waitForSchemaRemoval() {
  const deadline = Date.now() + 10_000;
  const probes = [
    ["events?select=id&limit=0", "PGRST205"],
    ["cash_sessions?select=event_id&limit=0", "42703"],
    ["sales?select=event_id&limit=0", "42703"],
    ["rpc/prepare_legacy_cash_session_insert", "PGRST202", {}],
    ["rpc/prepare_sale_insert", "PGRST202", {}],
    ["rpc/close_event", "PGRST202", { p_event_id: ids.event }],
    [
      "rpc/open_cash_session_v2",
      "PGRST202",
      {
        p_opening_amount_in_cents: 0,
        p_event_id: ids.event,
      },
    ],
    [
      "rpc/finalize_sale_v2",
      "PGRST202",
      {
        p_sale_id: ids.sale,
        p_items: [],
        p_payment: {},
      },
    ],
    [
      "rpc/finalize_sale",
      "PGRST202",
      {
        p_sale_id: ids.sale,
        p_event_id: ids.event,
        p_cash_session_id: ids.cash,
        p_completed_at: "2026-09-01T13:00:00Z",
        p_items: [],
        p_payment: {},
        p_total_in_cents: 0,
      },
    ],
  ];
  let failure;
  while (Date.now() < deadline) {
    try {
      await Promise.all(
        probes.map(async ([path, code, args]) => {
          const rpc = path.startsWith("rpc/");
          const response = await fetch(new URL(`rest/v1/${path}`, apiUrl), {
            method: rpc ? "POST" : "GET",
            headers: {
              apikey: environment.key,
              "Content-Type": "application/json",
            },
            ...(rpc ? { body: JSON.stringify(args) } : {}),
            signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
          });
          const body = await response.json();
          assert.equal(
            response.status,
            rpc ? 404 : path.startsWith("events") ? 404 : 400,
            `unexpected legacy API status for ${path}`,
          );
          assert.equal(body.code, code, `legacy API must be absent: ${path}`);
        }),
      );
      return;
    } catch (error) {
      failure = error;
      const remaining = deadline - Date.now();
      if (remaining > 0)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(200, remaining)),
        );
    }
  }
  throw (
    failure ??
    new Error("Legacy API schema did not disappear within 10 seconds")
  );
}

function resolveEnvironment() {
  const url = process.env.DATABASE_TEST_SUPABASE_URL;
  const key = process.env.DATABASE_TEST_SUPABASE_SECRET_KEY;
  if (url || key) {
    assert.ok(
      url && key,
      "Both upgrade fixture environment variables are required",
    );
    return { url, key };
  }
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["supabase", "status", "-o", "env"],
    {
      encoding: "utf8",
      shell: process.platform === "win32",
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
    },
  );
  assert.equal(result.status, 0, "Local Supabase stack is unavailable");
  const values = Object.fromEntries(
    result.stdout
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator),
          line.slice(separator + 1).replace(/^"|"$/g, ""),
        ];
      }),
  );
  assert.ok(
    values.API_URL && values.SECRET_KEY,
    "Local Supabase values are missing",
  );
  return { url: values.API_URL, key: values.SECRET_KEY };
}
