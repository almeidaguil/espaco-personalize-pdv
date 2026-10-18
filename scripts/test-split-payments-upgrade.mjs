import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const mode = process.argv[2];
assert.ok(
  [
    "seed-valid",
    "verify-valid",
    "seed-duplicate",
    "seed-invalid-payment",
  ].includes(mode),
  "Expected seed-valid, verify-valid, seed-duplicate or seed-invalid-payment mode",
);

const ids = {
  cashSale: "18100000-0000-4000-8000-000000000004",
  creditSale: "18100000-0000-4000-8000-000000000003",
  postUpgradeSale: "18100000-0000-4000-8000-000000000005",
  product: "18100000-0000-4000-8000-000000000002",
  user: "18100000-0000-4000-8000-000000000001",
};
const fixtureName = mode === "verify-valid" ? "seed-valid" : mode;
const email = `split-payments-${fixtureName}@local.invalid`;
const password = "Local-split-payment-upgrade!Aa1";
const environment = resolveEnvironment();
const apiUrl = new URL(environment.url);

assert.ok(
  ["127.0.0.1", "localhost", "::1", "[::1]"].includes(apiUrl.hostname),
  "Refusing to run the split payment upgrade fixture remotely",
);

const serviceClient = createClient(apiUrl.toString(), environment.secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

if (mode === "verify-valid") {
  await verifyValidUpgrade();
} else {
  await seedPreMigrationFixture();
}

async function seedPreMigrationFixture() {
  await assertLegacySchema();
  await createUser();
  const operatorClient = await signIn();

  const { error: productError } = await serviceClient.from("products").insert({
    id: ids.product,
    is_active: true,
    name: "Split payment upgrade product",
    price_in_cents: 1_000,
    sku: "SPLIT-UPGRADE",
  });
  assert.equal(productError, null, "could not seed upgrade product");

  const { error: stockError } = await serviceClient
    .from("stock_movements")
    .insert({
      product_id: ids.product,
      quantity_change: 20,
      type: "initial_adjustment",
    });
  assert.equal(stockError, null, "could not seed upgrade stock");

  const { data: cash, error: cashError } = await operatorClient.rpc(
    "open_cash_session_v3",
    { p_opening_amount_in_cents: 0 },
  );
  assert.equal(cashError, null, "could not open upgrade cash session");

  const creditResult = await operatorClient.rpc("finalize_sale_v4", {
    p_cash_session_id: cash.id,
    p_discount_in_cents: 0,
    p_items: [{ product_id: ids.product, quantity: 1 }],
    p_payment: {
      amount_in_cents: 1_000,
      change_in_cents: 0,
      method: "credit_card",
    },
    p_sale_id: ids.creditSale,
  });
  assert.equal(creditResult.error, null, "could not seed legacy credit sale");

  if (mode === "seed-valid") {
    const cashResult = await operatorClient.rpc("finalize_sale_v4", {
      p_cash_session_id: cash.id,
      p_discount_in_cents: 0,
      p_items: [{ product_id: ids.product, quantity: 1 }],
      p_payment: {
        amount_in_cents: 1_500,
        change_in_cents: 500,
        method: "cash",
      },
      p_sale_id: ids.cashSale,
    });
    assert.equal(cashResult.error, null, "could not seed legacy cash sale");
    console.log("Valid split payment upgrade fixture seeded locally.");
    return;
  }

  if (mode === "seed-duplicate") {
    const { error } = await serviceClient.from("payments").insert({
      amount_in_cents: 1_000,
      change_in_cents: 0,
      method: "credit_card",
      sale_id: ids.creditSale,
    });
    assert.equal(error, null, "could not seed duplicate payment method");
    console.log("Duplicate payment fixture seeded locally.");
    return;
  }

  const { error } = await serviceClient
    .from("payments")
    .update({ amount_in_cents: 1_000, change_in_cents: 1_000 })
    .eq("sale_id", ids.creditSale);
  assert.equal(error, null, "could not seed zero-net payment");
  console.log("Zero-net payment fixture seeded locally.");
}

async function verifyValidUpgrade() {
  const operatorClient = await signIn();
  const { data: payments, error: paymentsError } = await serviceClient
    .from("payments")
    .select("sale_id,method,installment_count")
    .in("sale_id", [ids.creditSale, ids.cashSale])
    .order("sale_id");
  assert.equal(paymentsError, null, "upgraded payments must be readable");
  assert.deepEqual(payments, [
    {
      installment_count: 1,
      method: "credit_card",
      sale_id: ids.creditSale,
    },
    {
      installment_count: null,
      method: "cash",
      sale_id: ids.cashSale,
    },
  ]);

  const { data: cash, error: cashError } = await serviceClient
    .from("cash_sessions")
    .select("id")
    .eq("operator_id", ids.user)
    .single();
  assert.equal(cashError, null, "upgraded cash session must survive");

  const saleResult = await operatorClient.rpc("finalize_sale_v4", {
    p_cash_session_id: cash.id,
    p_discount_in_cents: 0,
    p_items: [{ product_id: ids.product, quantity: 1 }],
    p_payment: {
      amount_in_cents: 1_000,
      change_in_cents: 0,
      method: "credit_card",
    },
    p_sale_id: ids.postUpgradeSale,
  });
  assert.equal(
    saleResult.error,
    null,
    "legacy V4 credit must remain available as one installment",
  );

  const { data: postUpgradePayment, error: postUpgradeError } =
    await serviceClient
      .from("payments")
      .select("installment_count")
      .eq("sale_id", ids.postUpgradeSale)
      .single();
  assert.equal(postUpgradeError, null);
  assert.equal(postUpgradePayment.installment_count, 1);

  const { count, error: reconciliationError } = await serviceClient
    .from("cash_session_reconciliations")
    .select("cash_session_id", { count: "exact", head: true });
  assert.equal(reconciliationError, null);
  assert.equal(count, 0, "upgrade must not fabricate reconciliation history");
  console.log("Split payment schema upgrade verified locally.");
}

async function assertLegacySchema() {
  const { error } = await serviceClient
    .from("payments")
    .select("installment_count")
    .limit(0);
  assert.equal(
    error?.code,
    "42703",
    "upgrade seed requires the pre-split-payment schema",
  );
}

async function createUser() {
  const { data, error } = await serviceClient.auth.admin.createUser({
    id: ids.user,
    email,
    email_confirm: true,
    password,
    user_metadata: { full_name: "Split payment upgrade" },
  });
  assert.equal(error, null, "could not create upgrade user");
  assert.equal(data.user.id, ids.user);
}

async function signIn() {
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
      "All split payment upgrade variables are required",
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
