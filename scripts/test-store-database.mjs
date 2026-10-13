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
const parsedSupabaseUrl = new URL(supabaseUrl);

if (!isLocalHostname(parsedSupabaseUrl.hostname)) {
  throw new Error(
    "Refusing to run database integration tests against a remote Supabase.",
  );
}

const serviceClient = createSupabaseClient(secretKey);
const testRunId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `Local-db-${randomUUID()}!Aa1`;
const identities = [
  createIdentity("admin"),
  createIdentity("operator-a"),
  createIdentity("operator-b"),
];
const createdUserIds = [];
let productId;
let concurrencyProductId;

try {
  for (const identity of identities) {
    const { data, error } = await serviceClient.auth.admin.createUser({
      email: identity.email,
      email_confirm: true,
      password,
      user_metadata: {
        full_name: identity.label,
      },
    });

    assert.equal(error, null, `could not create ${identity.label}`);
    assert.ok(data.user, `missing user for ${identity.label}`);
    identity.userId = data.user.id;
    createdUserIds.push(data.user.id);
  }

  const adminIdentity = identities[0];
  const operatorAIdentity = identities[1];
  const operatorBIdentity = identities[2];

  const { error: adminRoleError } = await serviceClient
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", adminIdentity.userId);
  assert.equal(adminRoleError, null, "could not promote the test admin");

  await Promise.all(
    identities.map(async (identity) => {
      identity.client = await createAuthenticatedClient(identity);
    }),
  );

  const operatorAConcurrentClients = await Promise.all([
    createAuthenticatedClient(operatorAIdentity),
    createAuthenticatedClient(operatorAIdentity),
  ]);

  const openedAfter = new Date();
  const [operatorAFirstOpen, operatorASecondOpen, operatorBOpen] =
    await Promise.all([
      operatorAConcurrentClients[0].rpc("open_cash_session_v3", {
        p_opening_amount_in_cents: 1_000,
      }),
      operatorAConcurrentClients[1].rpc("open_cash_session_v3", {
        p_opening_amount_in_cents: 1_000,
      }),
      operatorBIdentity.client.rpc("open_cash_session_v3", {
        p_opening_amount_in_cents: 2_000,
      }),
    ]);
  const openedBefore = new Date();
  const operatorAResults = [operatorAFirstOpen, operatorASecondOpen];
  const operatorASuccesses = operatorAResults.filter((result) => !result.error);
  const operatorAFailures = operatorAResults.filter((result) => result.error);

  assert.equal(
    operatorASuccesses.length,
    1,
    "exactly one concurrent opening must succeed for the same operator",
  );
  assert.equal(
    operatorAFailures.length,
    1,
    "exactly one concurrent opening must fail for the same operator",
  );
  assert.equal(
    operatorAFailures[0].error.code,
    "23505",
    "the concurrent opening must fail with a stable unique-conflict code",
  );
  assert.equal(
    operatorBOpen.error,
    null,
    "a different operator must open a cash session concurrently",
  );

  const operatorACashSessionId = operatorASuccesses[0].data.id;
  const operatorBCashSessionId = operatorBOpen.data.id;
  const { count: operatorAOpenCount, error: operatorAOpenCountError } =
    await serviceClient
      .from("cash_sessions")
      .select("id", { count: "exact", head: true })
      .eq("operator_id", operatorAIdentity.userId)
      .eq("status", "open");
  assert.equal(operatorAOpenCountError, null);
  assert.equal(
    operatorAOpenCount,
    1,
    "the database must persist exactly one open session for operator A",
  );
  const { data: operatorACashSession, error: operatorACashSessionError } =
    await operatorAIdentity.client
      .from("cash_sessions")
      .select("*")
      .eq("id", operatorACashSessionId)
      .single();
  assert.equal(
    operatorACashSessionError,
    null,
    "operator A must read its own cash session",
  );
  assert.deepEqual(
    operatorASuccesses[0].data,
    operatorACashSession,
    "opening must return the complete persisted session row",
  );
  assert.equal(operatorACashSession.operator_id, operatorAIdentity.userId);
  assert.equal(operatorACashSession.status, "open");
  assert.equal(operatorACashSession.opening_amount_in_cents, 1_000);
  assertServerTimestamp(
    operatorACashSession.opened_at,
    openedAfter,
    openedBefore,
  );
  assert.equal(
    operatorACashSession.business_date,
    formatBusinessDate(new Date(operatorACashSession.opened_at)),
    "business_date must use the Sao Paulo date of opening",
  );

  const { data: hiddenCashSessions, error: hiddenCashSessionsError } =
    await operatorAIdentity.client
      .from("cash_sessions")
      .select("id")
      .eq("id", operatorBCashSessionId);
  assert.equal(hiddenCashSessionsError, null);
  assert.deepEqual(
    hiddenCashSessions,
    [],
    "an operator must not read another operator's cash session",
  );

  const { data: adminVisibleCashSessions, error: adminCashSessionsError } =
    await adminIdentity.client
      .from("cash_sessions")
      .select("id")
      .in("id", [operatorACashSessionId, operatorBCashSessionId]);
  assert.equal(adminCashSessionsError, null);
  assert.equal(
    adminVisibleCashSessions.length,
    2,
    "an admin must read all operator cash sessions",
  );

  const { error: foreignCloseError } = await operatorBIdentity.client.rpc(
    "close_cash_session",
    {
      p_admin_password: null,
      p_cash_session_id: operatorACashSessionId,
      p_closed_at: new Date(Date.now() + 1_000).toISOString(),
      p_counted_amount_in_cents: 1_000,
    },
  );
  assert.ok(
    foreignCloseError,
    "an operator must not close another operator's cash session",
  );

  const { error: administrativeCloseError } = await adminIdentity.client.rpc(
    "close_cash_session",
    {
      p_admin_password: null,
      p_cash_session_id: operatorBCashSessionId,
      p_closed_at: new Date(Date.now() + 1_000).toISOString(),
      p_counted_amount_in_cents: 2_000,
    },
  );
  assert.equal(
    administrativeCloseError,
    null,
    "an admin must close another operator's cash session in contingency",
  );

  const { data: administrativelyClosedCash, error: closedCashReadError } =
    await serviceClient
      .from("cash_sessions")
      .select("status,closed_by")
      .eq("id", operatorBCashSessionId)
      .single();
  assert.equal(closedCashReadError, null);
  assert.equal(administrativelyClosedCash.status, "closed");
  assert.equal(administrativelyClosedCash.closed_by, adminIdentity.userId);

  const { error: directCashInsertError } = await adminIdentity.client
    .from("cash_sessions")
    .insert({
      opening_amount_in_cents: 0,
      operator_id: adminIdentity.userId,
      status: "open",
    });
  assertPermissionDenied(directCashInsertError, "direct cash insert");

  const timezoneCashSessionId = randomUUID();
  const { data: timezoneCashSession, error: timezoneCashSessionError } =
    await serviceClient
      .from("cash_sessions")
      .insert({
        closed_at: "2026-01-02T02:00:00.000Z",
        closed_by: operatorBIdentity.userId,
        counted_amount_in_cents: 0,
        difference_amount_in_cents: 0,
        expected_amount_in_cents: 0,
        id: timezoneCashSessionId,
        opened_at: "2026-01-02T01:00:00.000Z",
        opening_amount_in_cents: 0,
        operator_id: operatorBIdentity.userId,
        status: "closed",
      })
      .select("business_date")
      .single();
  assert.equal(timezoneCashSessionError, null);
  assert.equal(
    timezoneCashSession.business_date,
    "2026-01-01",
    "business_date must use Sao Paulo time across the UTC date boundary",
  );

  const { error: directCashUpdateError } = await operatorAIdentity.client
    .from("cash_sessions")
    .update({ opening_amount_in_cents: 999_999 })
    .eq("id", operatorACashSessionId);
  assert.ok(
    directCashUpdateError,
    "direct cash-session updates must be rejected",
  );

  const { data: product, error: productError } = await serviceClient
    .from("products")
    .insert({
      is_active: true,
      name: `Database gate product ${testRunId}`,
      price_in_cents: 1_000,
      sku: `DB-${testRunId}`,
    })
    .select("id")
    .single();
  assert.equal(productError, null, "could not create the test product");
  productId = product.id;

  const { error: stockError } = await serviceClient
    .from("stock_movements")
    .insert({
      product_id: productId,
      quantity_change: 10,
      type: "initial_adjustment",
    });
  assert.equal(stockError, null, "could not create the test stock balance");

  const { data: concurrencyProduct, error: concurrencyProductError } =
    await serviceClient
      .from("products")
      .insert({
        is_active: true,
        name: `Concurrent database gate product ${testRunId}`,
        price_in_cents: 1_000,
        sku: `DB-CONCURRENT-${testRunId}`,
      })
      .select("id")
      .single();
  assert.equal(
    concurrencyProductError,
    null,
    "could not create the concurrent test product",
  );
  concurrencyProductId = concurrencyProduct.id;

  const { error: concurrencyStockError } = await serviceClient
    .from("stock_movements")
    .insert({
      product_id: concurrencyProductId,
      quantity_change: 1,
      type: "initial_adjustment",
    });
  assert.equal(
    concurrencyStockError,
    null,
    "could not create the unit stock balance",
  );

  const {
    data: operatorBConcurrentCashSession,
    error: operatorBConcurrentOpenError,
  } = await operatorBIdentity.client.rpc("open_cash_session_v3", {
    p_opening_amount_in_cents: 0,
  });
  assert.equal(
    operatorBConcurrentOpenError,
    null,
    "operator B must reopen for concurrent sales",
  );

  const operatorAConcurrentSaleId = randomUUID();
  const operatorBConcurrentSaleId = randomUUID();
  const concurrentSalePayload = {
    p_items: [{ product_id: concurrencyProductId, quantity: 1 }],
    p_payment: {
      amount_in_cents: 1_000,
      change_in_cents: 0,
      method: "pix",
    },
  };
  const concurrentSaleResults = await Promise.all([
    operatorAIdentity.client.rpc("finalize_sale_v3", {
      ...concurrentSalePayload,
      p_cash_session_id: operatorACashSessionId,
      p_sale_id: operatorAConcurrentSaleId,
    }),
    operatorBIdentity.client.rpc("finalize_sale_v3", {
      ...concurrentSalePayload,
      p_cash_session_id: operatorBConcurrentCashSession.id,
      p_sale_id: operatorBConcurrentSaleId,
    }),
  ]);
  const concurrentSaleSuccesses = concurrentSaleResults.filter(
    (result) => !result.error,
  );
  const concurrentSaleFailures = concurrentSaleResults.filter(
    (result) => result.error,
  );
  assert.equal(
    concurrentSaleSuccesses.length,
    1,
    "exactly one concurrent sale must consume the last stock unit",
  );
  assert.equal(
    concurrentSaleFailures.length,
    1,
    "exactly one concurrent sale must fail for insufficient stock",
  );
  assert.match(concurrentSaleFailures[0].error.message, /insufficient stock/i);

  const { data: concurrencyStockMovements, error: concurrencyBalanceError } =
    await serviceClient
      .from("stock_movements")
      .select("quantity_change")
      .eq("product_id", concurrencyProductId);
  assert.equal(concurrencyBalanceError, null);
  assert.equal(
    concurrencyStockMovements.reduce(
      (balance, movement) => balance + movement.quantity_change,
      0,
    ),
    0,
    "concurrent sales must never make stock negative",
  );

  const closeRaceSaleId = randomUUID();
  const [closeRaceSaleResult, concurrentCloseResult] = await Promise.all([
    operatorBIdentity.client.rpc("finalize_sale_v3", {
      p_cash_session_id: operatorBConcurrentCashSession.id,
      p_items: [{ product_id: productId, quantity: 1 }],
      p_payment: {
        amount_in_cents: 1_000,
        change_in_cents: 0,
        method: "cash",
      },
      p_sale_id: closeRaceSaleId,
    }),
    operatorBIdentity.client.rpc("close_cash_session", {
      p_admin_password: null,
      p_cash_session_id: operatorBConcurrentCashSession.id,
      p_closed_at: new Date().toISOString(),
      p_counted_amount_in_cents: 1_000,
    }),
  ]);
  assert.equal(
    concurrentCloseResult.error,
    null,
    "closing must serialize successfully against a concurrent sale",
  );

  const { data: closeRaceCashSession, error: closeRaceCashSessionError } =
    await serviceClient
      .from("cash_sessions")
      .select("status,expected_amount_in_cents")
      .eq("id", operatorBConcurrentCashSession.id)
      .single();
  assert.equal(closeRaceCashSessionError, null);
  assert.equal(closeRaceCashSession.status, "closed");

  const { count: closeRaceSaleCount, error: closeRaceSaleCountError } =
    await serviceClient
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("id", closeRaceSaleId);
  assert.equal(closeRaceSaleCountError, null);

  if (closeRaceSaleResult.error) {
    assert.match(closeRaceSaleResult.error.message, /no open cash session/i);
    assert.equal(closeRaceSaleCount, 0);
    assert.equal(closeRaceCashSession.expected_amount_in_cents, 0);
  } else {
    assert.equal(closeRaceSaleResult.data, closeRaceSaleId);
    assert.equal(closeRaceSaleCount, 1);
    assert.equal(closeRaceCashSession.expected_amount_in_cents, 1_000);
  }

  const saleOperationId = randomUUID();
  const saleStartedAt = new Date();
  const { data: saleId, error: saleError } = await operatorAIdentity.client.rpc(
    "finalize_sale_v3",
    {
      p_items: [{ product_id: productId, quantity: 2 }],
      p_payment: {
        amount_in_cents: 2_500,
        change_in_cents: 500,
        method: "cash",
      },
      p_cash_session_id: operatorACashSessionId,
      p_sale_id: saleOperationId,
    },
  );
  const saleFinishedAt = new Date();
  assert.equal(saleError, null, "the event-free sale must succeed");
  assert.equal(saleId, saleOperationId);

  const { data: retriedSaleId, error: retrySaleError } =
    await operatorAIdentity.client.rpc("finalize_sale_v3", {
      p_items: [{ product_id: productId, quantity: 2 }],
      p_payment: {
        amount_in_cents: 2_500,
        change_in_cents: 500,
        method: "cash",
      },
      p_cash_session_id: operatorACashSessionId,
      p_sale_id: saleOperationId,
    });
  assert.equal(retrySaleError, null, "an identical sale retry must succeed");
  assert.equal(retriedSaleId, saleOperationId);

  const { error: divergentRetryError } = await operatorAIdentity.client.rpc(
    "finalize_sale_v3",
    {
      p_items: [{ product_id: productId, quantity: 1 }],
      p_payment: {
        amount_in_cents: 1_000,
        change_in_cents: 0,
        method: "pix",
      },
      p_cash_session_id: operatorACashSessionId,
      p_sale_id: saleOperationId,
    },
  );
  assert.match(
    divergentRetryError?.message ?? "",
    /different payload/i,
    "reusing a sale id with another payload must be rejected",
  );

  const { count: persistedSaleCount, error: persistedSaleCountError } =
    await serviceClient
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("id", saleOperationId);
  assert.equal(persistedSaleCountError, null);
  assert.equal(persistedSaleCount, 1, "a retry must not duplicate the sale");

  const { data: saleStockMovements, error: saleStockMovementsError } =
    await serviceClient
      .from("stock_movements")
      .select("quantity_change")
      .eq("sale_id", saleOperationId);
  assert.equal(saleStockMovementsError, null);
  assert.deepEqual(
    saleStockMovements.map((movement) => movement.quantity_change),
    [-2],
    "a retry must not duplicate the stock movement",
  );

  const { data: sale, error: saleReadError } = await operatorAIdentity.client
    .from("sales")
    .select(
      "id,cash_session_id,operator_id,total_in_cents,completed_at,sale_items(quantity),payments(method,amount_in_cents,change_in_cents)",
    )
    .eq("id", saleId)
    .single();
  assert.equal(saleReadError, null, "operator A must read its own sale");
  assert.equal(sale.cash_session_id, operatorACashSessionId);
  assert.equal(sale.operator_id, operatorAIdentity.userId);
  assert.equal(sale.total_in_cents, 2_000);
  assertServerTimestamp(sale.completed_at, saleStartedAt, saleFinishedAt);
  assert.equal(sale.sale_items[0].quantity, 2);
  assert.equal(sale.payments[0].method, "cash");

  const { data: operatorBSales, error: operatorBSalesError } =
    await operatorBIdentity.client
      .from("sales")
      .select("id,sale_items(id),payments(id)")
      .eq("id", saleId);
  assert.equal(operatorBSalesError, null);
  assert.deepEqual(
    operatorBSales,
    [],
    "an operator must not read another operator's sale or financial children",
  );

  const { data: operatorBSaleItems, error: operatorBSaleItemsError } =
    await operatorBIdentity.client
      .from("sale_items")
      .select("id")
      .eq("sale_id", saleId);
  assert.equal(operatorBSaleItemsError, null);
  assert.deepEqual(
    operatorBSaleItems,
    [],
    "an operator must not query another operator's sale items directly",
  );

  const { data: operatorBPayments, error: operatorBPaymentsError } =
    await operatorBIdentity.client
      .from("payments")
      .select("id")
      .eq("sale_id", saleId);
  assert.equal(operatorBPaymentsError, null);
  assert.deepEqual(
    operatorBPayments,
    [],
    "an operator must not query another operator's payments directly",
  );

  const { data: adminSales, error: adminSalesError } =
    await adminIdentity.client.from("sales").select("id").eq("id", saleId);
  assert.equal(adminSalesError, null);
  assert.equal(adminSales.length, 1, "an admin must read all sales");

  const { data: adminSaleItems, error: adminSaleItemsError } =
    await adminIdentity.client
      .from("sale_items")
      .select("id")
      .eq("sale_id", saleId);
  assert.equal(adminSaleItemsError, null);
  assert.equal(adminSaleItems.length, 1);

  const { data: adminPayments, error: adminPaymentsError } =
    await adminIdentity.client
      .from("payments")
      .select("id")
      .eq("sale_id", saleId);
  assert.equal(adminPaymentsError, null);
  assert.equal(adminPayments.length, 1);

  const salePayload = {
    p_sale_id: randomUUID(),
    p_cash_session_id: operatorBCashSessionId,
    p_items: [{ product_id: productId, quantity: 1 }],
    p_payment: { method: "pix", amount_in_cents: 1_000, change_in_cents: 0 },
  };
  const { error: foreignSessionSaleError } = await operatorBIdentity.client.rpc(
    "finalize_sale_v3",
    { ...salePayload, p_cash_session_id: operatorACashSessionId },
  );
  assert.match(
    foreignSessionSaleError?.message ?? "",
    /no open cash session/i,
    "a sale must reject another operator's session",
  );

  const { error: directSaleError } = await operatorAIdentity.client
    .from("sales")
    .insert({
      cash_session_id: operatorACashSessionId,
      operator_id: operatorAIdentity.userId,
      status: "completed",
      total_in_cents: 0,
    });
  assert.ok(directSaleError, "direct sale inserts must remain blocked");

  const { error: directSaleItemError } = await operatorAIdentity.client
    .from("sale_items")
    .insert({
      product_id: productId,
      product_name: "Forbidden direct item",
      quantity: 1,
      sale_id: saleId,
      total_in_cents: 1_000,
      unit_price_in_cents: 1_000,
    });
  assertPermissionDenied(directSaleItemError, "direct sale item insert");

  const { error: directPaymentError } = await operatorAIdentity.client
    .from("payments")
    .insert({
      amount_in_cents: 2_000,
      change_in_cents: 0,
      method: "cash",
      sale_id: saleId,
    });
  assertPermissionDenied(directPaymentError, "direct payment insert");

  const { error: directStockError } = await operatorAIdentity.client
    .from("stock_movements")
    .insert({
      product_id: productId,
      quantity_change: 1,
      type: "manual_adjustment",
    });
  assertPermissionDenied(directStockError, "direct operator stock insert");

  const anonymousClient = createSupabaseClient(publishableKey);
  const { error: anonymousRpcError } = await anonymousClient.rpc(
    "open_cash_session_v3",
    { p_opening_amount_in_cents: 0 },
  );
  assert.ok(anonymousRpcError, "anonymous RPC execution must be blocked");

  const { error: banError } = await serviceClient.auth.admin.updateUserById(
    operatorBIdentity.userId,
    { ban_duration: "876000h" },
  );
  assert.equal(banError, null, "could not ban the test operator");

  const { error: bannedOpenError } = await operatorBIdentity.client.rpc(
    "open_cash_session_v3",
    { p_opening_amount_in_cents: 0 },
  );
  assert.match(
    bannedOpenError?.message ?? "",
    /active user/i,
    "a banned user must not open through the new RPC",
  );

  const { error: bannedSaleError } = await operatorBIdentity.client.rpc(
    "finalize_sale_v3",
    salePayload,
  );
  assert.match(
    bannedSaleError?.message ?? "",
    /active user/i,
    "a banned user must not finalize a sale",
  );

  const { error: bannedCloseError } = await operatorBIdentity.client.rpc(
    "close_cash_session",
    {
      p_cash_session_id: operatorBCashSessionId,
      p_counted_amount_in_cents: 2_000,
      p_closed_at: new Date().toISOString(),
      p_admin_password: null,
    },
  );
  assert.match(
    bannedCloseError?.message ?? "",
    /active user/i,
    "a banned user must not close cash",
  );

  const { error: banAdminError } =
    await serviceClient.auth.admin.updateUserById(adminIdentity.userId, {
      ban_duration: "876000h",
    });
  assert.equal(banAdminError, null);
  const { error: bannedAdminCloseError } = await adminIdentity.client.rpc(
    "close_cash_session",
    {
      p_cash_session_id: operatorACashSessionId,
      p_counted_amount_in_cents: 3_000,
      p_closed_at: new Date().toISOString(),
      p_admin_password: null,
    },
  );
  assert.match(
    bannedAdminCloseError?.message ?? "",
    /active user/i,
    "a banned admin must not close another operator's cash",
  );

  const originalBusinessDate = operatorACashSession.business_date;
  const { error: closeError } = await operatorAIdentity.client.rpc(
    "close_cash_session",
    {
      p_admin_password: null,
      p_cash_session_id: operatorACashSessionId,
      p_closed_at: new Date(Date.now() + 1_000).toISOString(),
      p_counted_amount_in_cents: 3_000,
    },
  );
  assert.equal(
    closeError,
    null,
    "the operator must close its own cash session",
  );

  const { data: reopenedCashSessionRow, error: reopenError } =
    await operatorAIdentity.client.rpc("open_cash_session_v3", {
      p_opening_amount_in_cents: 0,
    });
  assert.equal(
    reopenError,
    null,
    "the same operator must reopen after closing",
  );

  const { data: reopenedCashSession, error: reopenedReadError } =
    await operatorAIdentity.client
      .from("cash_sessions")
      .select("business_date")
      .eq("id", reopenedCashSessionRow.id)
      .single();
  assert.equal(reopenedReadError, null);
  assert.equal(
    reopenedCashSession.business_date,
    originalBusinessDate,
    "same-day reopenings must share the business date",
  );

  const { error: staleSessionSaleError } = await operatorAIdentity.client.rpc(
    "finalize_sale_v3",
    { ...salePayload, p_cash_session_id: operatorACashSessionId },
  );
  assert.match(
    staleSessionSaleError?.message ?? "",
    /no open cash session/i,
    "a stale closed session must not be silently reassigned to the reopened cash",
  );

  const { error: reassignedRetryError } = await operatorAIdentity.client.rpc(
    "finalize_sale_v3",
    {
      p_sale_id: saleOperationId,
      p_cash_session_id: reopenedCashSessionRow.id,
      p_items: [{ product_id: productId, quantity: 2 }],
      p_payment: {
        method: "cash",
        amount_in_cents: 2_500,
        change_in_cents: 500,
      },
    },
  );
  assert.match(
    reassignedRetryError?.message ?? "",
    /different payload/i,
    "an idempotent retry must not change its original cash session",
  );

  const { data: postCloseRetryId, error: postCloseRetryError } =
    await operatorAIdentity.client.rpc("finalize_sale_v3", {
      p_sale_id: saleOperationId,
      p_cash_session_id: operatorACashSessionId,
      p_items: [{ product_id: productId, quantity: 2 }],
      p_payment: {
        method: "cash",
        amount_in_cents: 2_500,
        change_in_cents: 500,
      },
    });
  assert.equal(
    postCloseRetryError,
    null,
    "an already committed sale remains idempotent after its cash closes",
  );
  assert.equal(postCloseRetryId, saleOperationId);

  const { data: reopenedSaleId, error: reopenedSaleError } =
    await operatorAIdentity.client.rpc("finalize_sale_v3", {
      ...salePayload,
      p_cash_session_id: reopenedCashSessionRow.id,
    });
  assert.equal(
    reopenedSaleError,
    null,
    "the reopened exact session can receive sales",
  );
  const { data: reopenedSale, error: reopenedSaleReadError } =
    await serviceClient
      .from("sales")
      .select("cash_session_id")
      .eq("id", reopenedSaleId)
      .single();
  assert.equal(reopenedSaleReadError, null);
  assert.equal(reopenedSale.cash_session_id, reopenedCashSessionRow.id);

  console.log(
    "Database integration passed: concurrency, RLS, V3 RPCs, exact sessions, bans, audited close, and reopen.",
  );
} finally {
  await cleanupTestData();
}

function createIdentity(label) {
  return {
    client: undefined,
    email: `${label}-${testRunId}@local.invalid`,
    label,
    userId: undefined,
  };
}

function createSupabaseClient(key) {
  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function createAuthenticatedClient(identity) {
  const client = createSupabaseClient(publishableKey);
  const { error } = await client.auth.signInWithPassword({
    email: identity.email,
    password,
  });
  assert.equal(error, null, `could not sign in ${identity.label}`);

  return client;
}

function requireEnvironmentVariable(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isLocalHostname(hostname) {
  return ["127.0.0.1", "::1", "[::1]", "localhost"].includes(hostname);
}

function formatBusinessDate(date) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).format(date);
}

function assertServerTimestamp(value, startedAt, finishedAt) {
  const timestamp = new Date(value).getTime();

  assert.ok(
    timestamp >= startedAt.getTime() - 1_000 &&
      timestamp <= finishedAt.getTime() + 1_000,
    `expected server timestamp ${value} to be inside the request window`,
  );
}

function assertPermissionDenied(error, operation) {
  assert.ok(error, `${operation} must be rejected`);
  assert.ok(
    error.code === "42501" ||
      /permission|row-level security|violates row-level/i.test(
        `${error.message ?? ""} ${error.details ?? ""}`,
      ),
    `${operation} must fail because of permissions or RLS`,
  );
}

async function cleanupTestData() {
  const userIds = createdUserIds.filter(Boolean);
  const productIds = [productId, concurrencyProductId].filter(Boolean);

  if (productIds.length > 0) {
    await serviceClient
      .from("stock_movements")
      .delete()
      .in("product_id", productIds);
  }

  if (userIds.length > 0) {
    await serviceClient.from("sales").delete().in("operator_id", userIds);
    await serviceClient
      .from("cash_sessions")
      .delete()
      .in("operator_id", userIds);
  }

  if (productIds.length > 0) {
    await serviceClient.from("products").delete().in("id", productIds);
  }

  for (const userId of createdUserIds.reverse()) {
    await serviceClient.auth.admin.deleteUser(userId);
  }
}
