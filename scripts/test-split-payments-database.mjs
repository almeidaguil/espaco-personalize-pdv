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
    "Refusing to run split payment tests against a remote Supabase.",
  );
}

const serviceClient = createClient(supabaseUrl, secretKey, clientOptions());
const anonymousClient = createClient(
  supabaseUrl,
  publishableKey,
  clientOptions(),
);
const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `Local-split-${randomUUID()}!Aa1`;
const email = `split-payment-${runId}@local.invalid`;
let userId;
let productId;

try {
  const { data: createdUser, error: createUserError } =
    await serviceClient.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: { full_name: "Split payment operator" },
    });
  assert.equal(
    createUserError,
    null,
    "could not create split payment operator",
  );
  assert.ok(createdUser.user, "split payment operator was not returned");
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
  assert.equal(signInError, null, "could not sign in split payment operator");

  const { data: product, error: productError } = await serviceClient
    .from("products")
    .insert({
      is_active: true,
      name: `Split payment product ${runId}`,
      price_in_cents: 1_000,
      sku: `SPLIT-${runId}`.toUpperCase(),
    })
    .select("id")
    .single();
  assert.equal(productError, null, "could not create split payment product");
  productId = product.id;

  const { error: stockError } = await serviceClient
    .from("stock_movements")
    .insert({
      product_id: productId,
      quantity_change: 100,
      type: "initial_adjustment",
    });
  assert.equal(stockError, null, "could not seed split payment stock");

  const { data: cashSession, error: openError } = await operatorClient.rpc(
    "open_cash_session_v3",
    { p_opening_amount_in_cents: 0 },
  );
  assert.equal(openError, null, "could not open split payment cash session");

  const anonymousAttempt = await anonymousClient.rpc("finalize_sale_v5", {
    p_cash_session_id: cashSession.id,
    p_discount_in_cents: 0,
    p_items: saleItems(),
    p_payments: [{ amount_in_cents: 1_000, method: "pix" }],
    p_sale_id: randomUUID(),
  });
  assert.ok(anonymousAttempt.error, "anonymous V5 execution must be rejected");

  const pixSaleId = randomUUID();
  const pixResult = await finalize(operatorClient, cashSession.id, pixSaleId, {
    discount: 100,
    payments: [{ amount_in_cents: 900, method: "pix" }],
  });
  assert.equal(pixResult.error, null, "single Pix payment must succeed");

  const splitSaleId = randomUUID();
  const splitPayments = [
    { amount_in_cents: 400, method: "pix" },
    { amount_in_cents: 1_000, method: "cash" },
  ];
  const splitResult = await finalize(
    operatorClient,
    cashSession.id,
    splitSaleId,
    { payments: splitPayments },
  );
  assert.equal(splitResult.error, null, "Pix plus cash payment must succeed");
  assert.equal(splitResult.data, splitSaleId);

  const reversedRetry = await finalize(
    operatorClient,
    cashSession.id,
    splitSaleId,
    { payments: [...splitPayments].reverse() },
  );
  assert.equal(
    reversedRetry.error,
    null,
    "payment order must not change idempotency",
  );
  assert.equal(reversedRetry.data, splitSaleId);

  const { data: persistedSplit, error: splitReadError } = await serviceClient
    .from("sales")
    .select(
      "subtotal_in_cents,discount_in_cents,total_in_cents,payments(method,amount_in_cents,change_in_cents,installment_count)",
    )
    .eq("id", splitSaleId)
    .single();
  assert.equal(splitReadError, null);
  assert.deepEqual(persistedSplit, {
    discount_in_cents: 0,
    payments: [
      {
        amount_in_cents: 1_000,
        change_in_cents: 400,
        installment_count: null,
        method: "cash",
      },
      {
        amount_in_cents: 400,
        change_in_cents: 0,
        installment_count: null,
        method: "pix",
      },
    ],
    subtotal_in_cents: 1_000,
    total_in_cents: 1_000,
  });

  for (const installmentCount of [1, 2, 3]) {
    const creditSaleId = randomUUID();
    const creditResult = await finalize(
      operatorClient,
      cashSession.id,
      creditSaleId,
      {
        payments: [
          {
            amount_in_cents: 1_000,
            installment_count: installmentCount,
            method: "credit_card",
          },
        ],
      },
    );
    assert.equal(
      creditResult.error,
      null,
      `credit ${installmentCount}x must succeed`,
    );
    const { data: payment, error: paymentError } = await serviceClient
      .from("payments")
      .select("installment_count,change_in_cents")
      .eq("sale_id", creditSaleId)
      .single();
    assert.equal(paymentError, null);
    assert.deepEqual(payment, {
      change_in_cents: 0,
      installment_count: installmentCount,
    });
  }

  const invalidCases = [
    { label: "zero payments", payments: [] },
    {
      label: "three payments",
      payments: [
        { amount_in_cents: 400, method: "pix" },
        { amount_in_cents: 300, method: "cash" },
        { amount_in_cents: 300, method: "debit_card" },
      ],
    },
    {
      label: "duplicate method",
      payments: [
        { amount_in_cents: 500, method: "pix" },
        { amount_in_cents: 500, method: "pix" },
      ],
    },
    {
      label: "zero net cash contribution",
      payments: [
        { amount_in_cents: 1_000, method: "pix" },
        { amount_in_cents: 500, method: "cash" },
      ],
    },
    {
      label: "underpayment",
      payments: [{ amount_in_cents: 999, method: "pix" }],
    },
    {
      label: "non-cash overpayment",
      payments: [{ amount_in_cents: 1_001, method: "pix" }],
    },
    {
      label: "credit without installments",
      payments: [{ amount_in_cents: 1_000, method: "credit_card" }],
    },
    {
      label: "credit above three installments",
      payments: [
        {
          amount_in_cents: 1_000,
          installment_count: 4,
          method: "credit_card",
        },
      ],
    },
    {
      label: "installments on Pix",
      payments: [
        { amount_in_cents: 1_000, installment_count: 1, method: "pix" },
      ],
    },
  ];
  const invalidSaleIds = [];
  for (const invalidCase of invalidCases) {
    const saleId = randomUUID();
    invalidSaleIds.push(saleId);
    const result = await finalize(operatorClient, cashSession.id, saleId, {
      payments: invalidCase.payments,
    });
    assert.ok(result.error, `${invalidCase.label} must be rejected`);
  }

  const changedValue = await finalize(
    operatorClient,
    cashSession.id,
    splitSaleId,
    {
      payments: [
        { amount_in_cents: 401, method: "pix" },
        { amount_in_cents: 999, method: "cash" },
      ],
    },
  );
  assert.match(changedValue.error?.message ?? "", /different payload/i);

  const changedMethod = await finalize(
    operatorClient,
    cashSession.id,
    splitSaleId,
    {
      payments: [
        { amount_in_cents: 400, method: "debit_card" },
        { amount_in_cents: 1_000, method: "cash" },
      ],
    },
  );
  assert.match(changedMethod.error?.message ?? "", /different payload/i);

  const creditConflictSaleId = randomUUID();
  const creditPayload = {
    payments: [
      {
        amount_in_cents: 1_000,
        installment_count: 2,
        method: "credit_card",
      },
    ],
  };
  const initialCredit = await finalize(
    operatorClient,
    cashSession.id,
    creditConflictSaleId,
    creditPayload,
  );
  assert.equal(initialCredit.error, null);
  const changedInstallment = await finalize(
    operatorClient,
    cashSession.id,
    creditConflictSaleId,
    {
      payments: [
        {
          amount_in_cents: 1_000,
          installment_count: 3,
          method: "credit_card",
        },
      ],
    },
  );
  assert.match(changedInstallment.error?.message ?? "", /different payload/i);

  const legacyCreditSaleId = randomUUID();
  const legacyCredit = await operatorClient.rpc("finalize_sale_v4", {
    p_cash_session_id: cashSession.id,
    p_discount_in_cents: 0,
    p_items: saleItems(),
    p_payment: {
      amount_in_cents: 1_000,
      change_in_cents: 0,
      method: "credit_card",
    },
    p_sale_id: legacyCreditSaleId,
  });
  assert.equal(legacyCredit.error, null, "legacy credit must remain valid");
  const { data: legacyPayment, error: legacyPaymentError } = await serviceClient
    .from("payments")
    .select("installment_count")
    .eq("sale_id", legacyCreditSaleId)
    .single();
  assert.equal(legacyPaymentError, null);
  assert.equal(legacyPayment.installment_count, 1);

  const { count: invalidSales, error: invalidSalesError } = await serviceClient
    .from("sales")
    .select("id", { count: "exact", head: true })
    .in("id", invalidSaleIds);
  assert.equal(invalidSalesError, null);
  assert.equal(
    invalidSales,
    0,
    "invalid split sales must roll back completely",
  );

  const { data: splitMovements, error: splitMovementsError } =
    await serviceClient
      .from("stock_movements")
      .select("id")
      .eq("sale_id", splitSaleId);
  assert.equal(splitMovementsError, null);
  assert.equal(
    splitMovements.length,
    1,
    "idempotent retries must not reduce stock twice",
  );

  console.log(
    "Split payment integration passed: V5 validation, change, installments, idempotency, rollback, audit, and V4 compatibility.",
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

function saleItems() {
  return [{ product_id: productId, quantity: 1 }];
}

function finalize(client, cashSessionId, saleId, { discount = 0, payments }) {
  return client.rpc("finalize_sale_v5", {
    p_cash_session_id: cashSessionId,
    p_discount_in_cents: discount,
    p_items: saleItems(),
    p_payments: payments,
    p_sale_id: saleId,
  });
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
