import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = requireEnvironmentVariable("DATABASE_TEST_SUPABASE_URL");
const publishableKey = requireEnvironmentVariable(
  "DATABASE_TEST_SUPABASE_PUBLISHABLE_KEY",
);
const secretKey = requireEnvironmentVariable(
  "DATABASE_TEST_SUPABASE_SECRET_KEY",
);

if (!isLocalHostname(new URL(supabaseUrl).hostname)) {
  throw new Error(
    "Refusing to run sale discount tests against a remote Supabase.",
  );
}

const serviceClient = createClient(supabaseUrl, secretKey, clientOptions());
const anonymousClient = createClient(
  supabaseUrl,
  publishableKey,
  clientOptions(),
);
const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `Local-discount-${randomUUID()}!Aa1`;
const email = `sale-discount-${runId}@local.invalid`;
let userId;
let productId;

try {
  const { data: createdUser, error: createUserError } =
    await serviceClient.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: { full_name: "Discount operator" },
    });
  assert.equal(createUserError, null, "could not create discount operator");
  assert.ok(createdUser.user, "discount operator was not returned");
  userId = createdUser.user.id;

  const operatorClient = createClient(
    supabaseUrl,
    publishableKey,
    clientOptions(),
  );
  const { error: signInError } = await operatorClient.auth.signInWithPassword({
    email,
    password,
  });
  assert.equal(signInError, null, "could not sign in discount operator");

  const { data: product, error: productError } = await serviceClient
    .from("products")
    .insert({
      is_active: true,
      name: `Discount product ${runId}`,
      price_in_cents: 1_000,
      sku: `DISCOUNT-${runId}`.toUpperCase(),
    })
    .select("id")
    .single();
  assert.equal(productError, null, "could not create discount product");
  productId = product.id;

  const { error: stockError } = await serviceClient
    .from("stock_movements")
    .insert({
      product_id: productId,
      quantity_change: 10,
      type: "initial_adjustment",
    });
  assert.equal(stockError, null, "could not seed discount product stock");

  const { data: cashSession, error: openError } = await operatorClient.rpc(
    "open_cash_session_v3",
    { p_opening_amount_in_cents: 0 },
  );
  assert.equal(openError, null, "could not open discount test cash session");

  const anonymousAttempt = await anonymousClient.rpc("finalize_sale_v4", {
    p_cash_session_id: cashSession.id,
    p_discount_in_cents: 100,
    p_items: [{ product_id: productId, quantity: 1 }],
    p_payment: { amount_in_cents: 900, change_in_cents: 0, method: "pix" },
    p_sale_id: randomUUID(),
  });
  assert.ok(anonymousAttempt.error, "anonymous V4 execution must be rejected");

  const cashSaleId = randomUUID();
  const cashSalePayload = {
    p_cash_session_id: cashSession.id,
    p_discount_in_cents: 100,
    p_items: [{ product_id: productId, quantity: 2 }],
    p_payment: {
      amount_in_cents: 2_500,
      change_in_cents: 600,
      method: "cash",
    },
    p_sale_id: cashSaleId,
  };
  const cashSaleResult = await operatorClient.rpc(
    "finalize_sale_v4",
    cashSalePayload,
  );
  assert.equal(cashSaleResult.error, null, "discounted cash sale must succeed");
  assert.equal(cashSaleResult.data, cashSaleId);

  const retryResult = await operatorClient.rpc(
    "finalize_sale_v4",
    cashSalePayload,
  );
  assert.equal(
    retryResult.error,
    null,
    "identical discounted retry must succeed",
  );
  assert.equal(retryResult.data, cashSaleId);

  const divergentRetry = await operatorClient.rpc("finalize_sale_v4", {
    ...cashSalePayload,
    p_discount_in_cents: 101,
    p_payment: {
      amount_in_cents: 2_500,
      change_in_cents: 601,
      method: "cash",
    },
  });
  assert.match(divergentRetry.error?.message ?? "", /different payload/i);

  const { data: persistedCashSale, error: cashSaleReadError } =
    await serviceClient
      .from("sales")
      .select(
        "operator_id,subtotal_in_cents,discount_in_cents,total_in_cents,payments(amount_in_cents,change_in_cents),sale_items(quantity,total_in_cents)",
      )
      .eq("id", cashSaleId)
      .single();
  assert.equal(cashSaleReadError, null);
  assert.equal(persistedCashSale.operator_id, userId);
  assert.equal(persistedCashSale.subtotal_in_cents, 2_000);
  assert.equal(persistedCashSale.discount_in_cents, 100);
  assert.equal(persistedCashSale.total_in_cents, 1_900);
  assert.deepEqual(persistedCashSale.payments, [
    { amount_in_cents: 2_500, change_in_cents: 600 },
  ]);
  assert.deepEqual(persistedCashSale.sale_items, [
    { quantity: 2, total_in_cents: 2_000 },
  ]);

  const pixSaleId = randomUUID();
  const pixResult = await operatorClient.rpc("finalize_sale_v4", {
    p_cash_session_id: cashSession.id,
    p_discount_in_cents: 1,
    p_items: [{ product_id: productId, quantity: 1 }],
    p_payment: { amount_in_cents: 999, change_in_cents: 0, method: "pix" },
    p_sale_id: pixSaleId,
  });
  assert.equal(pixResult.error, null, "discounted Pix sale must succeed");

  const invalidDiscountSaleId = randomUUID();
  const invalidDiscountResult = await operatorClient.rpc("finalize_sale_v4", {
    p_cash_session_id: cashSession.id,
    p_discount_in_cents: 1_000,
    p_items: [{ product_id: productId, quantity: 1 }],
    p_payment: { amount_in_cents: 0, change_in_cents: 0, method: "cash" },
    p_sale_id: invalidDiscountSaleId,
  });
  assert.match(invalidDiscountResult.error?.message ?? "", /lower than/i);

  const invalidPaymentSaleId = randomUUID();
  const invalidPaymentResult = await operatorClient.rpc("finalize_sale_v4", {
    p_cash_session_id: cashSession.id,
    p_discount_in_cents: 100,
    p_items: [{ product_id: productId, quantity: 1 }],
    p_payment: { amount_in_cents: 901, change_in_cents: 0, method: "pix" },
    p_sale_id: invalidPaymentSaleId,
  });
  assert.match(
    invalidPaymentResult.error?.message ?? "",
    /match the sale total/i,
  );

  const { count: rolledBackSales, error: rollbackCountError } =
    await serviceClient
      .from("sales")
      .select("id", { count: "exact", head: true })
      .in("id", [invalidDiscountSaleId, invalidPaymentSaleId]);
  assert.equal(rollbackCountError, null);
  assert.equal(rolledBackSales, 0, "invalid discounted sales must roll back");

  const legacySaleId = randomUUID();
  const legacyResult = await operatorClient.rpc("finalize_sale_v3", {
    p_cash_session_id: cashSession.id,
    p_items: [{ product_id: productId, quantity: 1 }],
    p_payment: {
      amount_in_cents: 1_000,
      change_in_cents: 0,
      method: "debit_card",
    },
    p_sale_id: legacySaleId,
  });
  assert.equal(
    legacyResult.error,
    null,
    "V3 zero-discount sale must remain valid",
  );

  const { data: legacySale, error: legacyReadError } = await serviceClient
    .from("sales")
    .select("subtotal_in_cents,discount_in_cents,total_in_cents")
    .eq("id", legacySaleId)
    .single();
  assert.equal(legacyReadError, null);
  assert.deepEqual(legacySale, {
    discount_in_cents: 0,
    subtotal_in_cents: 1_000,
    total_in_cents: 1_000,
  });

  const inconsistentUpdate = await serviceClient
    .from("sales")
    .update({ total_in_cents: 1_899 })
    .eq("id", cashSaleId);
  assert.equal(
    inconsistentUpdate.error?.code,
    "23514",
    "database constraints must reject inconsistent sale totals",
  );

  const closeResult = await operatorClient.rpc("close_cash_session", {
    p_admin_password: null,
    p_cash_session_id: cashSession.id,
    p_closed_at: new Date().toISOString(),
    p_counted_amount_in_cents: 1_900,
  });
  assert.equal(
    closeResult.error,
    null,
    "discount test cash must close reconciled",
  );

  const postCloseRetry = await operatorClient.rpc(
    "finalize_sale_v4",
    cashSalePayload,
  );
  assert.equal(
    postCloseRetry.error,
    null,
    "V4 retry must survive cash closing",
  );
  assert.equal(postCloseRetry.data, cashSaleId);

  const closedCashSale = await operatorClient.rpc("finalize_sale_v4", {
    ...cashSalePayload,
    p_sale_id: randomUUID(),
  });
  assert.match(closedCashSale.error?.message ?? "", /no open cash session/i);

  const { data: movements, error: movementError } = await serviceClient
    .from("stock_movements")
    .select("quantity_change,sale_id")
    .eq("product_id", productId);
  assert.equal(movementError, null);
  assert.equal(
    movements.reduce((total, movement) => total + movement.quantity_change, 0),
    6,
    "only three committed sales may reduce the initial stock",
  );
  assert.equal(
    movements.filter((movement) => movement.sale_id === cashSaleId).length,
    1,
    "retries must not duplicate stock movements",
  );

  console.log(
    "Sale discount integration passed: V4 cash/Pix, audit, rollback, idempotency, constraints, V3 compatibility, and closed-cash retry.",
  );
} finally {
  if (productId) {
    await serviceClient
      .from("stock_movements")
      .delete()
      .eq("product_id", productId);
  }
  if (userId) {
    await serviceClient.from("sales").delete().eq("operator_id", userId);
    await serviceClient
      .from("cash_sessions")
      .delete()
      .eq("operator_id", userId);
  }
  if (productId) {
    await serviceClient.from("products").delete().eq("id", productId);
  }
  if (userId) {
    await serviceClient.auth.admin.deleteUser(userId);
  }
}

function clientOptions() {
  return {
    auth: { autoRefreshToken: false, persistSession: false },
  };
}

function requireEnvironmentVariable(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isLocalHostname(hostname) {
  return ["127.0.0.1", "::1", "[::1]", "localhost"].includes(hostname);
}
