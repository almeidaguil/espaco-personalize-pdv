import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const mode = process.argv[2];
assert.ok(
  ["seed-valid", "verify-valid", "seed-invalid"].includes(mode),
  "Expected seed-valid, verify-valid or seed-invalid mode",
);

const ids = {
  invalidSale: "14100000-0000-4000-8000-000000000005",
  invalidUser: "14100000-0000-4000-8000-000000000004",
  product: "14100000-0000-4000-8000-000000000002",
  sale: "14100000-0000-4000-8000-000000000003",
  user: "14100000-0000-4000-8000-000000000001",
};
const password = "Local-discount-upgrade!Aa1";
const environment = resolveEnvironment();
const apiUrl = new URL(environment.url);

assert.ok(
  ["127.0.0.1", "localhost", "::1", "[::1]"].includes(apiUrl.hostname),
  "Refusing to run the sale discount upgrade fixture remotely",
);

const serviceClient = createClient(apiUrl.toString(), environment.secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

if (mode === "seed-valid") {
  await assertLegacySchema();
  await createUser(ids.user, "discount-upgrade@local.invalid");
  const operatorClient = await signIn("discount-upgrade@local.invalid");

  const { error: productError } = await serviceClient.from("products").insert({
    id: ids.product,
    is_active: true,
    name: "Sale discount upgrade product",
    price_in_cents: 1_000,
    sku: "DISCOUNT-UPGRADE",
  });
  assert.equal(productError, null, "could not seed upgrade product");

  const { error: stockError } = await serviceClient
    .from("stock_movements")
    .insert({
      product_id: ids.product,
      quantity_change: 5,
      type: "initial_adjustment",
    });
  assert.equal(stockError, null, "could not seed upgrade stock");

  const { data: cash, error: cashError } = await operatorClient.rpc(
    "open_cash_session_v3",
    { p_opening_amount_in_cents: 0 },
  );
  assert.equal(cashError, null, "could not open upgrade cash session");

  const saleResult = await operatorClient.rpc("finalize_sale_v3", {
    ...legacyPayload(cash.id),
    p_sale_id: ids.sale,
  });
  assert.equal(saleResult.error, null, "could not seed legacy V3 sale");
  assert.equal(saleResult.data, ids.sale);
  console.log("Valid sale discount upgrade fixture seeded locally.");
} else if (mode === "verify-valid") {
  const operatorClient = await signIn("discount-upgrade@local.invalid");
  const { data: cash, error: cashError } = await serviceClient
    .from("cash_sessions")
    .select("id")
    .eq("operator_id", ids.user)
    .single();
  assert.equal(cashError, null, "upgraded cash session must survive");

  const { data: sale, error: saleError } = await serviceClient
    .from("sales")
    .select("subtotal_in_cents,discount_in_cents,total_in_cents")
    .eq("id", ids.sale)
    .single();
  assert.equal(saleError, null, "legacy sale must survive discount upgrade");
  assert.deepEqual(sale, {
    discount_in_cents: 0,
    subtotal_in_cents: 2_000,
    total_in_cents: 2_000,
  });

  const retryResult = await operatorClient.rpc("finalize_sale_v3", {
    ...legacyPayload(cash.id),
    p_sale_id: ids.sale,
  });
  assert.equal(
    retryResult.error,
    null,
    "legacy V3 fingerprint must remain idempotent after upgrade",
  );
  assert.equal(retryResult.data, ids.sale);

  const { count: paymentCount, error: paymentCountError } = await serviceClient
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("sale_id", ids.sale);
  assert.equal(paymentCountError, null);
  assert.equal(paymentCount, 1, "legacy retry must not duplicate payment");

  const { count: movementCount, error: movementCountError } =
    await serviceClient
      .from("stock_movements")
      .select("id", { count: "exact", head: true })
      .eq("sale_id", ids.sale);
  assert.equal(movementCountError, null);
  assert.equal(movementCount, 1, "legacy retry must not duplicate stock");
  console.log("Sale discount upgrade and legacy V3 retry verified locally.");
} else {
  await assertLegacySchema();
  await createUser(ids.invalidUser, "discount-invalid@local.invalid");
  const operatorClient = await signIn("discount-invalid@local.invalid");
  const { data: cash, error: cashError } = await operatorClient.rpc(
    "open_cash_session_v3",
    { p_opening_amount_in_cents: 0 },
  );
  assert.equal(cashError, null, "could not open invalid fixture cash");

  const { error: invalidSaleError } = await serviceClient.from("sales").insert({
    cash_session_id: cash.id,
    id: ids.invalidSale,
    operator_id: ids.invalidUser,
    status: "completed",
    total_in_cents: 0,
  });
  assert.equal(invalidSaleError, null, "could not seed non-positive sale");
  console.log("Non-positive sale fixture seeded locally.");
}

function legacyPayload(cashSessionId) {
  return {
    p_cash_session_id: cashSessionId,
    p_items: [{ product_id: ids.product, quantity: 2 }],
    p_payment: {
      amount_in_cents: 2_500,
      change_in_cents: 500,
      method: "cash",
    },
  };
}

async function assertLegacySchema() {
  const { error } = await serviceClient
    .from("sales")
    .select("subtotal_in_cents")
    .limit(0);
  assert.equal(
    error?.code,
    "42703",
    "upgrade seed requires the pre-discount schema",
  );
}

async function createUser(id, email) {
  const { data, error } = await serviceClient.auth.admin.createUser({
    id,
    email,
    email_confirm: true,
    password,
    user_metadata: { full_name: "Sale discount upgrade" },
  });
  assert.equal(error, null, "could not create upgrade user");
  assert.equal(data.user.id, id);
}

async function signIn(email) {
  const client = createClient(apiUrl.toString(), environment.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  assert.equal(error, null, "could not sign in upgrade user");
  return client;
}

function resolveEnvironment() {
  const url = process.env.DATABASE_TEST_SUPABASE_URL;
  const publishableKey = process.env.DATABASE_TEST_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.DATABASE_TEST_SUPABASE_SECRET_KEY;
  if (url || publishableKey || secretKey) {
    assert.ok(
      url && publishableKey && secretKey,
      "All sale discount upgrade variables are required",
    );
    return { publishableKey, secretKey, url };
  }

  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["supabase", "status", "-o", "env"],
    {
      encoding: "utf8",
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
      shell: process.platform === "win32",
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
  assert.ok(values.API_URL && values.PUBLISHABLE_KEY && values.SECRET_KEY);
  return {
    publishableKey: values.PUBLISHABLE_KEY,
    secretKey: values.SECRET_KEY,
    url: values.API_URL,
  };
}
