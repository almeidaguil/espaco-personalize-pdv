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
let adminUserId;
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

  const adminEmail = `split-payment-admin-${runId}@local.invalid`;
  const { data: createdAdmin, error: createAdminError } =
    await serviceClient.auth.admin.createUser({
      email: adminEmail,
      email_confirm: true,
      password,
      user_metadata: { full_name: "Split payment admin" },
    });
  assert.equal(createAdminError, null, "could not create split payment admin");
  assert.ok(createdAdmin.user, "split payment admin was not returned");
  adminUserId = createdAdmin.user.id;
  const { error: promoteAdminError } = await serviceClient
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", adminUserId);
  assert.equal(
    promoteAdminError,
    null,
    "could not promote split payment admin",
  );
  const adminClient = createClient(
    supabaseUrl,
    publishableKey,
    clientOptions(),
  );
  const { error: adminSignInError } = await adminClient.auth.signInWithPassword(
    {
      email: adminEmail,
      password,
    },
  );
  assert.equal(adminSignInError, null, "could not sign in split payment admin");

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

  await testCashReconciliation({
    adminClient,
    adminPassword: password,
    cashSessionId: cashSession.id,
    operatorClient,
  });

  console.log(
    "Split payment integration passed: V5 validation, change, installments, idempotency, rollback, audit, and V4 compatibility.",
  );
} finally {
  const reconciliationUserIds = [userId, adminUserId].filter(Boolean);
  if (reconciliationUserIds.length > 0) {
    const { data: cashSessions } = await serviceClient
      .from("cash_sessions")
      .select("id")
      .in("operator_id", reconciliationUserIds);
    const cashSessionIds = (cashSessions ?? []).map((session) => session.id);
    if (cashSessionIds.length > 0) {
      await serviceClient
        .from("cash_session_reconciliations")
        .delete()
        .in("cash_session_id", cashSessionIds);
    }
  }
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
  if (adminUserId) {
    await serviceClient.auth.admin.deleteUser(adminUserId);
  }
}

async function testCashReconciliation({
  adminClient,
  adminPassword,
  cashSessionId,
  operatorClient,
}) {
  const exactCurrentCounts = await expectedCounts(cashSessionId, 0);
  const exactCurrentClose = await closeV2(
    operatorClient,
    cashSessionId,
    exactCurrentCounts,
  );
  assert.equal(exactCurrentClose.error, null, "exact V2 close must succeed");

  const { data: creditSession, error: creditOpenError } =
    await operatorClient.rpc("open_cash_session_v3", {
      p_opening_amount_in_cents: 0,
    });
  assert.equal(creditOpenError, null);
  const creditSale = await finalize(
    operatorClient,
    creditSession.id,
    randomUUID(),
    {
      payments: [
        {
          amount_in_cents: 20_000,
          installment_count: 3,
          method: "credit_card",
        },
      ],
      quantity: 20,
    },
  );
  assert.equal(creditSale.error, null);
  const creditClose = await closeV2(operatorClient, creditSession.id, {
    cash: 0,
    credit_card: 20_000,
    debit_card: 0,
    pix: 0,
  });
  assert.equal(creditClose.error, null, "credit-only close must succeed");
  const { data: creditReconciliations, error: creditReconciliationError } =
    await serviceClient
      .from("cash_session_reconciliations")
      .select(
        "method,expected_amount_in_cents,counted_amount_in_cents,difference_amount_in_cents",
      )
      .eq("cash_session_id", creditSession.id)
      .order("method");
  assert.equal(creditReconciliationError, null);
  assert.equal(creditReconciliations.length, 4);
  assert.deepEqual(
    creditReconciliations.find((row) => row.method === "credit_card"),
    {
      counted_amount_in_cents: 20_000,
      difference_amount_in_cents: 0,
      expected_amount_in_cents: 20_000,
      method: "credit_card",
    },
  );
  const { data: creditCashRow, error: creditCashRowError } = await serviceClient
    .from("cash_sessions")
    .select(
      "expected_amount_in_cents,counted_amount_in_cents,difference_amount_in_cents",
    )
    .eq("id", creditSession.id)
    .single();
  assert.equal(creditCashRowError, null);
  assert.deepEqual(creditCashRow, {
    counted_amount_in_cents: 0,
    difference_amount_in_cents: 0,
    expected_amount_in_cents: 0,
  });

  const { data: differenceSession, error: differenceOpenError } =
    await operatorClient.rpc("open_cash_session_v3", {
      p_opening_amount_in_cents: 1_000,
    });
  assert.equal(differenceOpenError, null);
  const splitSale = await finalize(
    operatorClient,
    differenceSession.id,
    randomUUID(),
    {
      payments: [
        { amount_in_cents: 400, method: "pix" },
        { amount_in_cents: 1_000, method: "cash" },
      ],
    },
  );
  assert.equal(splitSale.error, null);
  const canceledSaleId = randomUUID();
  const canceledSale = await finalize(
    operatorClient,
    differenceSession.id,
    canceledSaleId,
    { payments: [{ amount_in_cents: 1_000, method: "debit_card" }] },
  );
  assert.equal(canceledSale.error, null);
  const cancelResult = await operatorClient.rpc("cancel_sale", {
    p_admin_password: adminPassword,
    p_canceled_at: new Date().toISOString(),
    p_sale_id: canceledSaleId,
  });
  assert.equal(cancelResult.error, null);

  const incomplete = await operatorClient.rpc("close_cash_session_v2", {
    p_admin_password: null,
    p_cash_session_id: differenceSession.id,
    p_reconciliations: [{ counted_amount_in_cents: 1_600, method: "cash" }],
  });
  assert.ok(incomplete.error, "incomplete reconciliation must fail");
  const duplicate = await operatorClient.rpc("close_cash_session_v2", {
    p_admin_password: null,
    p_cash_session_id: differenceSession.id,
    p_reconciliations: [
      { counted_amount_in_cents: 1_600, method: "cash" },
      { counted_amount_in_cents: 0, method: "cash" },
      { counted_amount_in_cents: 400, method: "pix" },
      { counted_amount_in_cents: 0, method: "credit_card" },
    ],
  });
  assert.ok(duplicate.error, "duplicate reconciliation method must fail");
  const negative = await closeV2(operatorClient, differenceSession.id, {
    cash: -1,
    credit_card: 0,
    debit_card: 0,
    pix: 400,
  });
  assert.ok(negative.error, "negative counted value must fail");

  const oppositeDifferences = {
    cash: 1_610,
    credit_card: 0,
    debit_card: 0,
    pix: 390,
  };
  const withoutPassword = await closeV2(
    operatorClient,
    differenceSession.id,
    oppositeDifferences,
  );
  assert.match(withoutPassword.error?.message ?? "", /admin password/i);
  const invalidPassword = await closeV2(
    operatorClient,
    differenceSession.id,
    oppositeDifferences,
    "invalid-admin-password",
  );
  assert.match(invalidPassword.error?.message ?? "", /admin password/i);
  const { count: prematureRows, error: prematureRowsError } =
    await serviceClient
      .from("cash_session_reconciliations")
      .select("method", { count: "exact", head: true })
      .eq("cash_session_id", differenceSession.id);
  assert.equal(prematureRowsError, null);
  assert.equal(prematureRows, 0, "failed close must not persist partial rows");

  const authorizedDifference = await closeV2(
    operatorClient,
    differenceSession.id,
    oppositeDifferences,
    adminPassword,
  );
  assert.equal(authorizedDifference.error, null);
  const { data: differenceRows, error: differenceRowsError } =
    await serviceClient
      .from("cash_session_reconciliations")
      .select("method,difference_amount_in_cents")
      .eq("cash_session_id", differenceSession.id);
  assert.equal(differenceRowsError, null);
  assert.deepEqual(
    Object.fromEntries(
      differenceRows.map((row) => [row.method, row.difference_amount_in_cents]),
    ),
    { cash: 10, credit_card: 0, debit_card: 0, pix: -10 },
  );
  const { data: differenceCashRow, error: differenceCashRowError } =
    await serviceClient
      .from("cash_sessions")
      .select(
        "expected_amount_in_cents,counted_amount_in_cents,difference_amount_in_cents",
      )
      .eq("id", differenceSession.id)
      .single();
  assert.equal(differenceCashRowError, null);
  assert.deepEqual(differenceCashRow, {
    counted_amount_in_cents: 1_610,
    difference_amount_in_cents: 10,
    expected_amount_in_cents: 1_600,
  });

  const { data: adminSession, error: adminOpenError } = await adminClient.rpc(
    "open_cash_session_v3",
    { p_opening_amount_in_cents: 0 },
  );
  assert.equal(adminOpenError, null);
  const adminDifference = { cash: 1, credit_card: 0, debit_card: 0, pix: 0 };
  const adminWithoutPassword = await closeV2(
    adminClient,
    adminSession.id,
    adminDifference,
  );
  assert.match(
    adminWithoutPassword.error?.message ?? "",
    /admin password/i,
    "admins must also provide a password for any difference",
  );
  const adminWithPassword = await closeV2(
    adminClient,
    adminSession.id,
    adminDifference,
    adminPassword,
  );
  assert.equal(adminWithPassword.error, null);

  const { data: raceSession, error: raceOpenError } = await operatorClient.rpc(
    "open_cash_session_v3",
    {
      p_opening_amount_in_cents: 0,
    },
  );
  assert.equal(raceOpenError, null);
  const concurrentClients = await Promise.all([
    createSignedInClient(email, password),
    createSignedInClient(email, password),
  ]);
  const exactZero = { cash: 0, credit_card: 0, debit_card: 0, pix: 0 };
  const raceResults = await Promise.all(
    concurrentClients.map((client) =>
      closeV2(client, raceSession.id, exactZero),
    ),
  );
  assert.equal(
    raceResults.filter((result) => !result.error).length,
    1,
    "exactly one concurrent close must succeed",
  );
  assert.equal(
    raceResults.filter((result) => result.error).length,
    1,
    "the second concurrent close must fail",
  );
  const { count: raceRows, error: raceRowsError } = await serviceClient
    .from("cash_session_reconciliations")
    .select("method", { count: "exact", head: true })
    .eq("cash_session_id", raceSession.id);
  assert.equal(raceRowsError, null);
  assert.equal(raceRows, 4, "concurrent close must persist one complete set");
}

function saleItems(quantity = 1) {
  return [{ product_id: productId, quantity }];
}

function finalize(
  client,
  cashSessionId,
  saleId,
  { discount = 0, payments, quantity = 1 },
) {
  return client.rpc("finalize_sale_v5", {
    p_cash_session_id: cashSessionId,
    p_discount_in_cents: discount,
    p_items: saleItems(quantity),
    p_payments: payments,
    p_sale_id: saleId,
  });
}

function closeV2(client, cashSessionId, counts, adminPassword = null) {
  return client.rpc("close_cash_session_v2", {
    p_admin_password: adminPassword,
    p_cash_session_id: cashSessionId,
    p_reconciliations: Object.entries(counts).map(
      ([method, countedAmountInCents]) => ({
        counted_amount_in_cents: countedAmountInCents,
        method,
      }),
    ),
  });
}

async function expectedCounts(cashSessionId, openingAmountInCents) {
  const counts = {
    cash: openingAmountInCents,
    credit_card: 0,
    debit_card: 0,
    pix: 0,
  };
  const { data, error } = await serviceClient
    .from("payments")
    .select(
      "method,amount_in_cents,change_in_cents,sales!inner(cash_session_id,status)",
    )
    .eq("sales.cash_session_id", cashSessionId)
    .eq("sales.status", "completed");
  assert.equal(error, null);
  for (const payment of data) {
    counts[payment.method] += payment.amount_in_cents - payment.change_in_cents;
  }
  return counts;
}

async function createSignedInClient(identityEmail, identityPassword) {
  const client = createClient(supabaseUrl, publishableKey, clientOptions());
  const { error } = await client.auth.signInWithPassword({
    email: identityEmail,
    password: identityPassword,
  });
  assert.equal(error, null);
  return client;
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
