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
    "Refusing to run report integration tests against a remote Supabase.",
  );
}

const serviceClient = createSupabaseClient(secretKey);
const testRunId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `Local-report-${randomUUID()}!Aa1`;
const identities = {
  admin: createIdentity("admin"),
  operatorA: createIdentity("operator-a"),
  operatorB: createIdentity("operator-b"),
};
const createdUserIds = [];
const cashSessionIds = {
  operatorAFirst: randomUUID(),
  operatorASecond: randomUUID(),
  operatorACrossMidnight: randomUUID(),
  operatorB: randomUUID(),
  rpcConcurrent: randomUUID(),
  rpcTimestamp: randomUUID(),
  volume: randomUUID(),
};
let productId;
const extraProductIds = [];

try {
  for (const identity of Object.values(identities)) {
    const { data, error } = await serviceClient.auth.admin.createUser({
      email: identity.email,
      email_confirm: true,
      password,
      user_metadata: { full_name: identity.label },
    });

    assert.equal(error, null, `could not create ${identity.label}`);
    assert.ok(data.user, `missing user for ${identity.label}`);
    identity.userId = data.user.id;
    createdUserIds.push(data.user.id);
  }

  const { error: adminRoleError } = await serviceClient
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", identities.admin.userId);
  assert.equal(adminRoleError, null, "could not promote report test admin");

  await Promise.all(
    Object.values(identities).map(async (identity) => {
      identity.client = await createAuthenticatedClient(identity);
    }),
  );

  const { data: product, error: productError } = await serviceClient
    .from("products")
    .insert({
      is_active: true,
      name: `Report product ${testRunId}`,
      price_in_cents: 1_000,
      sku: `REPORT-${testRunId}`,
    })
    .select("id")
    .single();
  assert.equal(productError, null, "could not create report test product");
  productId = product.id;

  const { data: extraProducts, error: extraProductsError } = await serviceClient
    .from("products")
    .insert(
      [2, 3].map((suffix) => ({
        is_active: true,
        name: `Report product ${suffix} ${testRunId}`,
        price_in_cents: 0,
        sku: `REPORT-${suffix}-${testRunId}`,
      })),
    )
    .select("id");
  assert.equal(
    extraProductsError,
    null,
    "could not create report pagination products",
  );
  extraProductIds.push(...extraProducts.map((item) => item.id));

  const { error: sessionError } = await serviceClient
    .from("cash_sessions")
    .insert([
      closedSession({
        closedAt: "2026-09-15T20:00:00.000Z",
        counted: 10_800,
        difference: -200,
        expected: 11_000,
        id: cashSessionIds.operatorAFirst,
        openedAt: "2026-09-15T12:00:00.000Z",
        opening: 1_000,
        operatorId: identities.operatorA.userId,
      }),
      closedSession({
        closedAt: "2026-09-15T21:00:00.000Z",
        counted: 100,
        difference: 100,
        expected: 0,
        id: cashSessionIds.operatorASecond,
        openedAt: "2026-09-15T13:00:00.000Z",
        opening: 0,
        operatorId: identities.operatorA.userId,
      }),
      closedSession({
        closedAt: "2026-09-16T06:00:00.000Z",
        counted: 0,
        difference: 0,
        expected: 0,
        id: cashSessionIds.operatorACrossMidnight,
        openedAt: "2026-09-16T01:00:00.000Z",
        opening: 0,
        operatorId: identities.operatorA.userId,
      }),
      {
        event_id: null,
        id: cashSessionIds.operatorB,
        opened_at: "2026-09-15T14:00:00.000Z",
        opening_amount_in_cents: 0,
        operator_id: identities.operatorB.userId,
        status: "open",
      },
      closedSession({
        closedAt: "2026-09-14T20:00:00.000Z",
        counted: 0,
        difference: 0,
        expected: 0,
        id: cashSessionIds.volume,
        openedAt: "2026-09-14T12:00:00.000Z",
        opening: 0,
        operatorId: identities.operatorA.userId,
      }),
    ]);
  assert.equal(sessionError, null, "could not create report cash sessions");

  const sales = [
    saleFixture({
      cashSessionId: cashSessionIds.operatorAFirst,
      completedAt: "2026-09-15T15:00:00.000Z",
      operatorId: identities.operatorA.userId,
      total: 10_000,
    }),
    saleFixture({
      canceledAt: "2026-09-15T19:00:00.000Z",
      cashSessionId: cashSessionIds.operatorAFirst,
      completedAt: "2026-09-15T16:00:00.000Z",
      operatorId: identities.operatorA.userId,
      status: "canceled",
      total: 5_000,
    }),
    saleFixture({
      cashSessionId: cashSessionIds.operatorASecond,
      completedAt: "2026-09-15T17:00:00.000Z",
      operatorId: identities.operatorA.userId,
      total: 20_000,
    }),
    saleFixture({
      cashSessionId: cashSessionIds.operatorB,
      completedAt: "2026-09-15T18:00:00.000Z",
      operatorId: identities.operatorB.userId,
      total: 30_000,
    }),
    saleFixture({
      cashSessionId: cashSessionIds.operatorACrossMidnight,
      completedAt: "2026-09-16T05:00:00.000Z",
      operatorId: identities.operatorA.userId,
      total: 4_000,
    }),
    saleFixture({
      canceledAfterCashClose: true,
      canceledAt: "2026-09-16T15:00:00.000Z",
      cashSessionId: cashSessionIds.operatorAFirst,
      completedAt: "2026-09-15T18:30:00.000Z",
      operatorId: identities.operatorA.userId,
      status: "canceled",
      total: 7_000,
    }),
  ];
  const { error: salesError } = await serviceClient.from("sales").insert(sales);
  assert.equal(salesError, null, "could not create report sales");

  const paymentMethods = [
    "cash",
    "pix",
    "credit_card",
    "pix",
    "debit_card",
    "debit_card",
  ];
  const payments = sales.map((sale, index) => ({
    amount_in_cents: index === 0 ? 12_000 : sale.total_in_cents,
    change_in_cents: index === 0 ? 2_000 : 0,
    method: paymentMethods[index],
    sale_id: sale.id,
  }));
  const items = sales.map((sale) => ({
    product_id: productId,
    product_name: `Report product ${testRunId}`,
    quantity: 1,
    sale_id: sale.id,
    total_in_cents: sale.total_in_cents,
    unit_price_in_cents: sale.total_in_cents,
  }));
  const { error: paymentError } = await serviceClient
    .from("payments")
    .insert(payments);
  assert.equal(paymentError, null, "could not create report payments");
  const { error: itemError } = await serviceClient
    .from("sale_items")
    .insert(items);
  assert.equal(itemError, null, "could not create report sale items");

  const { error: paginationItemsError } = await serviceClient
    .from("sale_items")
    .insert(
      extraProductIds.map((extraProductId, index) => ({
        product_id: extraProductId,
        product_name: `Report product ${index + 2} ${testRunId}`,
        quantity: 1,
        sale_id: sales[0].id,
        total_in_cents: 0,
        unit_price_in_cents: 0,
      })),
    );
  assert.equal(
    paginationItemsError,
    null,
    "could not create report pagination items",
  );

  const reportFilters = {
    p_cash_session_id: null,
    p_end_date: "2026-09-15",
    p_operator_id: null,
    p_start_date: "2026-09-15",
  };
  const { data: operatorAReport, error: operatorAReportError } =
    await identities.operatorA.client.rpc(
      "get_store_sales_report_v2",
      reportFilters,
    );
  assert.equal(operatorAReportError, null, "operator A report must succeed");
  assert.equal(operatorAReport.completed_sales_count, 4);
  assert.equal(operatorAReport.completed_total_in_cents, 41_000);
  assert.equal(operatorAReport.canceled_sales_count, 1);
  assert.equal(operatorAReport.canceled_total_in_cents, 5_000);
  assert.equal(operatorAReport.cash_shortage_total_in_cents, 200);
  assert.equal(operatorAReport.cash_surplus_total_in_cents, 100);
  assert.equal(operatorAReport.cash_difference_total_in_cents, -100);
  assert.equal(operatorAReport.post_close_adjustments_count, 0);
  assert.equal(operatorAReport.net_revenue_in_cents, 41_000);
  assert.deepEqual(
    operatorAReport.operator_options.map((operator) => operator.id),
    [identities.operatorA.userId],
    "an operator must only enumerate their own identity",
  );
  assert.equal(
    operatorAReport.sessions.some(
      (session) => session.id === cashSessionIds.operatorACrossMidnight,
    ),
    true,
    "a sale after midnight must stay on the session opening business date",
  );

  const { data: firstSessionsPage, error: firstSessionsPageError } =
    await identities.operatorA.client.rpc("get_store_sales_report_v2", {
      ...reportFilters,
      p_items_limit: 200,
      p_items_offset: 0,
      p_sessions_limit: 2,
      p_sessions_offset: 0,
    });
  assert.equal(firstSessionsPageError, null, "first report page must succeed");
  assert.equal(firstSessionsPage.sessions_total_count, 3);
  assert.equal(firstSessionsPage.sessions.length, 2);

  const { data: lastSessionsPage, error: lastSessionsPageError } =
    await identities.operatorA.client.rpc("get_store_sales_report_v2", {
      ...reportFilters,
      p_items_limit: 200,
      p_items_offset: 200,
      p_sessions_limit: 2,
      p_sessions_offset: 2,
    });
  assert.equal(lastSessionsPageError, null, "last report page must succeed");
  assert.equal(lastSessionsPage.sessions_total_count, 3);
  assert.equal(lastSessionsPage.sessions.length, 1);

  const { error: invalidPageSizeError } = await identities.operatorA.client.rpc(
    "get_store_sales_report_v2",
    {
      ...reportFilters,
      p_items_limit: 201,
      p_items_offset: 0,
      p_sessions_limit: 8,
      p_sessions_offset: 0,
    },
  );
  assert.match(
    invalidPageSizeError?.message ?? "",
    /page size/i,
    "the database must reject unbounded report pages",
  );

  const { data: firstItemsPage, error: firstItemsPageError } =
    await identities.operatorA.client.rpc("get_store_sales_report_v2", {
      ...reportFilters,
      p_items_limit: 2,
      p_items_offset: 0,
      p_sessions_limit: 200,
      p_sessions_offset: 0,
    });
  assert.equal(firstItemsPageError, null, "first product page must succeed");
  assert.equal(firstItemsPage.items_total_count, 3);
  assert.equal(firstItemsPage.items.length, 2);

  const { data: lastItemsPage, error: lastItemsPageError } =
    await identities.operatorA.client.rpc("get_store_sales_report_v2", {
      ...reportFilters,
      p_items_limit: 2,
      p_items_offset: 2,
      p_sessions_limit: 200,
      p_sessions_offset: 0,
    });
  assert.equal(lastItemsPageError, null, "last product page must succeed");
  assert.equal(lastItemsPage.items_total_count, 3);
  assert.equal(lastItemsPage.items.length, 1);

  const { error: foreignOperatorError } = await identities.operatorA.client.rpc(
    "get_store_sales_report_v2",
    {
      ...reportFilters,
      p_operator_id: identities.operatorB.userId,
    },
  );
  assert.equal(
    foreignOperatorError?.code,
    "42501",
    "an operator must not filter another operator",
  );

  const { error: foreignSessionError } = await identities.operatorA.client.rpc(
    "get_store_sales_report_v2",
    {
      ...reportFilters,
      p_cash_session_id: cashSessionIds.operatorB,
    },
  );
  assert.equal(
    foreignSessionError?.code,
    "42501",
    "an operator must not inspect another operator cash session",
  );

  const { data: adminReport, error: adminReportError } =
    await identities.admin.client.rpc(
      "get_store_sales_report_v2",
      reportFilters,
    );
  assert.equal(adminReportError, null, "admin report must succeed");
  assert.equal(adminReport.completed_sales_count, 5);
  assert.equal(adminReport.completed_total_in_cents, 71_000);
  assert.equal(adminReport.canceled_sales_count, 1);
  assert.deepEqual(
    Object.fromEntries(
      adminReport.payment_summary.map((payment) => [
        payment.method,
        payment.net_total_in_cents,
      ]),
    ),
    { cash: 10_000, credit_card: 20_000, debit_card: 11_000, pix: 30_000 },
    "completed payments must be aggregated without canceled payments",
  );

  const { data: sessionReport, error: sessionReportError } =
    await identities.admin.client.rpc("get_store_sales_report_v2", {
      ...reportFilters,
      p_cash_session_id: cashSessionIds.operatorAFirst,
      p_operator_id: identities.operatorA.userId,
    });
  assert.equal(
    sessionReportError,
    null,
    "session filter must succeed for admin",
  );
  assert.equal(sessionReport.completed_sales_count, 2);
  assert.equal(sessionReport.completed_total_in_cents, 17_000);
  assert.equal(sessionReport.canceled_sales_count, 1);
  assert.equal(sessionReport.canceled_total_in_cents, 5_000);

  const { data: adjustmentReport, error: adjustmentReportError } =
    await identities.admin.client.rpc("get_store_sales_report_v2", {
      p_cash_session_id: cashSessionIds.operatorAFirst,
      p_end_date: "2026-09-16",
      p_operator_id: identities.operatorA.userId,
      p_start_date: "2026-09-16",
    });
  assert.equal(
    adjustmentReportError,
    null,
    "post-close adjustment report must succeed on cancellation date",
  );
  assert.equal(adjustmentReport.completed_sales_count, 0);
  assert.equal(adjustmentReport.post_close_adjustments_count, 1);
  assert.equal(adjustmentReport.post_close_adjustments_total_in_cents, 7_000);
  assert.equal(adjustmentReport.net_revenue_in_cents, -7_000);
  assert.equal(
    adjustmentReport.post_close_adjustment_payment_summary.find(
      (payment) => payment.method === "debit_card",
    ).net_total_in_cents,
    7_000,
  );
  assert.equal(
    adjustmentReport.cash_session_options.some(
      (session) => session.id === cashSessionIds.operatorAFirst,
    ),
    true,
    "the adjusted historical session must remain available as a filter option",
  );

  const rpcSale = saleFixture({
    cashSessionId: cashSessionIds.rpcTimestamp,
    completedAt: new Date().toISOString(),
    operatorId: identities.operatorA.userId,
    total: 1_000,
  });
  const { error: rpcSessionError } = await serviceClient
    .from("cash_sessions")
    .insert({
      event_id: null,
      id: cashSessionIds.rpcTimestamp,
      opened_at: new Date(Date.now() - 60_000).toISOString(),
      opening_amount_in_cents: 0,
      operator_id: identities.operatorA.userId,
      status: "open",
    });
  assert.equal(rpcSessionError, null, "could not create RPC timestamp session");
  const { error: rpcSaleError } = await serviceClient
    .from("sales")
    .insert(rpcSale);
  assert.equal(rpcSaleError, null, "could not create RPC timestamp sale");
  const { error: rpcPaymentError } = await serviceClient
    .from("payments")
    .insert({
      amount_in_cents: 1_000,
      change_in_cents: 0,
      method: "cash",
      sale_id: rpcSale.id,
    });
  assert.equal(rpcPaymentError, null, "could not create RPC timestamp payment");
  const { error: rpcItemError } = await serviceClient
    .from("sale_items")
    .insert({
      product_id: productId,
      product_name: `Report product ${testRunId}`,
      quantity: 1,
      sale_id: rpcSale.id,
      total_in_cents: 1_000,
      unit_price_in_cents: 1_000,
    });
  assert.equal(rpcItemError, null, "could not create RPC timestamp item");

  const beforeClose = Date.now();
  const { error: closeRpcError } = await identities.operatorA.client.rpc(
    "close_cash_session",
    {
      p_admin_password: null,
      p_cash_session_id: cashSessionIds.rpcTimestamp,
      p_closed_at: "2099-01-01T00:00:00.000Z",
      p_counted_amount_in_cents: 1_000,
    },
  );
  assert.equal(closeRpcError, null, "cash close RPC must succeed");

  const { error: cancelRpcError } = await identities.operatorA.client.rpc(
    "cancel_sale",
    {
      p_admin_password: password,
      p_canceled_at: "2000-01-01T00:00:00.000Z",
      p_sale_id: rpcSale.id,
    },
  );
  assert.equal(cancelRpcError, null, "sale cancellation RPC must succeed");

  const { data: persistedRpcSession, error: persistedRpcSessionError } =
    await serviceClient
      .from("cash_sessions")
      .select("closed_at, expected_amount_in_cents")
      .eq("id", cashSessionIds.rpcTimestamp)
      .single();
  assert.equal(
    persistedRpcSessionError,
    null,
    "could not inspect RPC timestamp session",
  );
  const { data: persistedRpcSale, error: persistedRpcSaleError } =
    await serviceClient
      .from("sales")
      .select("canceled_at, canceled_business_date")
      .eq("id", rpcSale.id)
      .single();
  assert.equal(
    persistedRpcSaleError,
    null,
    "could not inspect RPC timestamp sale",
  );
  assert.ok(
    Date.parse(persistedRpcSession.closed_at) >= beforeClose - 1_000 &&
      Date.parse(persistedRpcSession.closed_at) <= Date.now() + 1_000,
    "cash close must persist a server-authoritative timestamp",
  );
  assert.ok(
    Date.parse(persistedRpcSale.canceled_at) >
      Date.parse(persistedRpcSession.closed_at),
    "a cancellation serialized after close must remain a post-close adjustment",
  );
  assert.equal(persistedRpcSession.expected_amount_in_cents, 1_000);

  const { data: rpcAdjustmentReport, error: rpcAdjustmentReportError } =
    await identities.operatorA.client.rpc("get_store_sales_report_v2", {
      p_cash_session_id: cashSessionIds.rpcTimestamp,
      p_end_date: persistedRpcSale.canceled_business_date,
      p_operator_id: identities.operatorA.userId,
      p_start_date: persistedRpcSale.canceled_business_date,
    });
  assert.equal(
    rpcAdjustmentReportError,
    null,
    "RPC post-close adjustment report must succeed",
  );
  assert.equal(rpcAdjustmentReport.completed_sales_count, 1);
  assert.equal(rpcAdjustmentReport.completed_total_in_cents, 1_000);
  assert.equal(rpcAdjustmentReport.post_close_adjustments_count, 1);
  assert.equal(
    rpcAdjustmentReport.post_close_adjustments_total_in_cents,
    1_000,
  );
  assert.equal(rpcAdjustmentReport.net_revenue_in_cents, 0);

  const concurrentSale = saleFixture({
    cashSessionId: cashSessionIds.rpcConcurrent,
    completedAt: new Date().toISOString(),
    operatorId: identities.operatorA.userId,
    total: 2_000,
  });
  const { error: concurrentSessionError } = await serviceClient
    .from("cash_sessions")
    .insert({
      event_id: null,
      id: cashSessionIds.rpcConcurrent,
      opened_at: new Date(Date.now() - 60_000).toISOString(),
      opening_amount_in_cents: 0,
      operator_id: identities.operatorA.userId,
      status: "open",
    });
  assert.equal(
    concurrentSessionError,
    null,
    "could not create concurrent RPC session",
  );
  const { error: concurrentSaleError } = await serviceClient
    .from("sales")
    .insert(concurrentSale);
  assert.equal(
    concurrentSaleError,
    null,
    "could not create concurrent RPC sale",
  );
  const { error: concurrentPaymentError } = await serviceClient
    .from("payments")
    .insert({
      amount_in_cents: 2_000,
      change_in_cents: 0,
      method: "cash",
      sale_id: concurrentSale.id,
    });
  assert.equal(
    concurrentPaymentError,
    null,
    "could not create concurrent RPC payment",
  );
  const { error: concurrentItemError } = await serviceClient
    .from("sale_items")
    .insert({
      product_id: productId,
      product_name: `Report product ${testRunId}`,
      quantity: 1,
      sale_id: concurrentSale.id,
      total_in_cents: 2_000,
      unit_price_in_cents: 2_000,
    });
  assert.equal(
    concurrentItemError,
    null,
    "could not create concurrent RPC item",
  );

  const [concurrentCloseResult, concurrentCancelResult] = await Promise.all([
    identities.operatorA.client.rpc("close_cash_session", {
      p_admin_password: password,
      p_cash_session_id: cashSessionIds.rpcConcurrent,
      p_closed_at: "2099-01-01T00:00:00.000Z",
      p_counted_amount_in_cents: 2_000,
    }),
    identities.operatorA.client.rpc("cancel_sale", {
      p_admin_password: password,
      p_canceled_at: "2000-01-01T00:00:00.000Z",
      p_sale_id: concurrentSale.id,
    }),
  ]);
  assert.equal(
    concurrentCloseResult.error,
    null,
    "concurrent cash close must succeed",
  );
  assert.equal(
    concurrentCancelResult.error,
    null,
    "concurrent cancellation must succeed",
  );

  const { data: concurrentSession, error: concurrentSessionReadError } =
    await serviceClient
      .from("cash_sessions")
      .select("expected_amount_in_cents")
      .eq("id", cashSessionIds.rpcConcurrent)
      .single();
  assert.equal(concurrentSessionReadError, null);
  const { data: concurrentPersistedSale, error: concurrentSaleReadError } =
    await serviceClient
      .from("sales")
      .select("canceled_business_date")
      .eq("id", concurrentSale.id)
      .single();
  assert.equal(concurrentSaleReadError, null);

  const { data: concurrentReport, error: concurrentReportError } =
    await identities.operatorA.client.rpc("get_store_sales_report_v2", {
      p_cash_session_id: cashSessionIds.rpcConcurrent,
      p_end_date: concurrentPersistedSale.canceled_business_date,
      p_operator_id: identities.operatorA.userId,
      p_start_date: concurrentPersistedSale.canceled_business_date,
    });
  assert.equal(
    concurrentReportError,
    null,
    "concurrent close/cancel report must succeed",
  );
  const closeIncludedSale =
    concurrentSession.expected_amount_in_cents === 2_000;
  assert.equal(
    concurrentReport.completed_sales_count,
    closeIncludedSale ? 1 : 0,
    "the report must preserve exactly the sale state observed by close",
  );
  assert.equal(
    concurrentReport.canceled_sales_count,
    closeIncludedSale ? 0 : 1,
    "a pre-close cancellation must remain canceled in the original session",
  );
  assert.equal(
    concurrentReport.post_close_adjustments_count,
    closeIncludedSale ? 1 : 0,
    "a sale included by close must become a post-close adjustment",
  );
  assert.equal(concurrentReport.net_revenue_in_cents, 0);

  const volumeSales = Array.from({ length: 1_001 }, (_, index) =>
    saleFixture({
      cashSessionId: cashSessionIds.volume,
      completedAt: `2026-09-14T${String(12 + (index % 8)).padStart(2, "0")}:00:00.000Z`,
      operatorId: identities.operatorA.userId,
      total: 1,
    }),
  );
  const { error: volumeSalesError } = await serviceClient
    .from("sales")
    .insert(volumeSales);
  assert.equal(volumeSalesError, null, "could not create volume report sales");
  const { error: volumePaymentsError } = await serviceClient
    .from("payments")
    .insert(
      volumeSales.map((sale) => ({
        amount_in_cents: 1,
        change_in_cents: 0,
        method: "pix",
        sale_id: sale.id,
      })),
    );
  assert.equal(
    volumePaymentsError,
    null,
    "could not create volume report payments",
  );
  const { error: volumeItemsError } = await serviceClient
    .from("sale_items")
    .insert(
      volumeSales.map((sale) => ({
        product_id: productId,
        product_name: `Report product ${testRunId}`,
        quantity: 1,
        sale_id: sale.id,
        total_in_cents: 1,
        unit_price_in_cents: 1,
      })),
    );
  assert.equal(volumeItemsError, null, "could not create volume report items");

  const { data: volumeReport, error: volumeReportError } =
    await identities.admin.client.rpc("get_store_sales_report_v2", {
      p_cash_session_id: cashSessionIds.volume,
      p_end_date: "2026-09-14",
      p_export_mode: true,
      p_items_limit: 10_000,
      p_items_offset: 0,
      p_operator_id: identities.operatorA.userId,
      p_sessions_limit: 10_000,
      p_sessions_offset: 0,
      p_start_date: "2026-09-14",
    });
  assert.equal(volumeReportError, null, "volume report must succeed");
  assert.equal(
    volumeReport.completed_sales_count,
    1_001,
    "database aggregation must not truncate at the PostgREST row limit",
  );
  assert.equal(volumeReport.completed_total_in_cents, 1_001);
  assert.equal(volumeReport.items[0].quantity, 1_001);

  const anonymousClient = createSupabaseClient(publishableKey);
  const { error: anonymousReportError } = await anonymousClient.rpc(
    "get_store_sales_report_v2",
    reportFilters,
  );
  assert.ok(anonymousReportError, "anonymous report execution must be blocked");

  const { error: banError } = await serviceClient.auth.admin.updateUserById(
    identities.operatorB.userId,
    { ban_duration: "876000h" },
  );
  assert.equal(banError, null, "could not ban report test operator");
  const { error: bannedReportError } = await identities.operatorB.client.rpc(
    "get_store_sales_report_v2",
    reportFilters,
  );
  assert.match(
    bannedReportError?.message ?? "",
    /active user/i,
    "a banned user must not generate reports with an existing token",
  );

  const bannedDirectReads = await Promise.all([
    identities.operatorB.client
      .from("profiles")
      .select("id")
      .eq("id", identities.operatorB.userId),
    identities.operatorB.client
      .from("cash_sessions")
      .select("id")
      .eq("operator_id", identities.operatorB.userId),
    identities.operatorB.client
      .from("sales")
      .select("id")
      .eq("operator_id", identities.operatorB.userId),
    identities.operatorB.client
      .from("sale_items")
      .select("id")
      .eq("sale_id", sales[3].id),
    identities.operatorB.client
      .from("payments")
      .select("id")
      .eq("sale_id", sales[3].id),
  ]);

  for (const directRead of bannedDirectReads) {
    assert.equal(directRead.error, null);
    assert.deepEqual(
      directRead.data,
      [],
      "RLS must hide financial data from a banned user with an existing token",
    );
  }

  console.log(
    "Report integration passed: period, RLS, filters, cancellation, close/cancel concurrency, reconciliation, midnight, and >1000 sales.",
  );
} finally {
  await cleanupTestData();
}

function createIdentity(label) {
  return {
    client: undefined,
    email: `report-${label}-${testRunId}@local.invalid`,
    label,
    userId: undefined,
  };
}

function closedSession({
  closedAt,
  counted,
  difference,
  expected,
  id,
  openedAt,
  opening,
  operatorId,
}) {
  return {
    closed_at: closedAt,
    closed_by: operatorId,
    counted_amount_in_cents: counted,
    difference_amount_in_cents: difference,
    event_id: null,
    expected_amount_in_cents: expected,
    id,
    opened_at: openedAt,
    opening_amount_in_cents: opening,
    operator_id: operatorId,
    status: "closed",
  };
}

function saleFixture({
  canceledAfterCashClose = false,
  canceledAt = null,
  cashSessionId,
  completedAt,
  operatorId,
  status = "completed",
  total,
}) {
  return {
    canceled_after_cash_close: canceledAfterCashClose,
    canceled_at: canceledAt,
    cash_session_id: cashSessionId,
    completed_at: completedAt,
    event_id: null,
    id: randomUUID(),
    operator_id: operatorId,
    status,
    total_in_cents: total,
  };
}

function createSupabaseClient(key) {
  return createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
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
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isLocalHostname(hostname) {
  return ["127.0.0.1", "::1", "localhost"].includes(hostname);
}

async function cleanupTestData() {
  if (createdUserIds.length > 0) {
    await serviceClient
      .from("sales")
      .delete()
      .in("operator_id", createdUserIds);
    await serviceClient
      .from("cash_sessions")
      .delete()
      .in("operator_id", createdUserIds);
  }
  const allProductIds = [productId, ...extraProductIds].filter(Boolean);
  if (allProductIds.length > 0) {
    await serviceClient.from("products").delete().in("id", allProductIds);
  }
  for (const userId of createdUserIds.reverse()) {
    await serviceClient.auth.admin.deleteUser(userId);
  }
}
