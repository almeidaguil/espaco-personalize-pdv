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
let eventId;
let inactiveEventId;
let productId;

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

  const { data: event, error: eventError } = await serviceClient
    .from("events")
    .insert({
      is_active: true,
      name: `Legacy compatibility ${testRunId}`,
      starts_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  assert.equal(eventError, null, "could not create the compatibility event");
  eventId = event.id;

  const { data: inactiveEvent, error: inactiveEventError } = await serviceClient
    .from("events")
    .insert({
      is_active: false,
      name: `Inactive event ${testRunId}`,
      starts_at: new Date(Date.now() - 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  assert.equal(inactiveEventError, null, "could not create the inactive event");
  inactiveEventId = inactiveEvent.id;

  const openedAfter = new Date();
  const [operatorAFirstOpen, operatorASecondOpen, operatorBOpen] =
    await Promise.all([
      operatorAConcurrentClients[0].rpc("open_cash_session_v2", {
        p_opening_amount_in_cents: 1_000,
      }),
      operatorAConcurrentClients[1].rpc("open_cash_session_v2", {
        p_opening_amount_in_cents: 1_000,
      }),
      operatorBIdentity.client.rpc("open_cash_session_v2", {
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

  const operatorACashSessionId = operatorASuccesses[0].data;
  const operatorBCashSessionId = operatorBOpen.data;
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
      .select(
        "id,event_id,operator_id,opened_at,business_date,opening_amount_in_cents,status",
      )
      .eq("id", operatorACashSessionId)
      .single();
  assert.equal(
    operatorACashSessionError,
    null,
    "operator A must read its own cash session",
  );
  assert.equal(operatorACashSession.operator_id, operatorAIdentity.userId);
  assert.equal(operatorACashSession.event_id, null);
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

  const { error: inactiveEventOpenError } = await operatorBIdentity.client
    .from("cash_sessions")
    .insert({
      event_id: inactiveEventId,
      id: randomUUID(),
      opened_at: new Date().toISOString(),
      opening_amount_in_cents: 0,
      operator_id: operatorBIdentity.userId,
      status: "open",
    });
  assert.match(
    inactiveEventOpenError?.message ?? "",
    /active event/i,
    "the legacy insert must reject inactive events",
  );

  const forgedOpenedAt = "2000-01-01T00:00:00.000Z";
  const legacyCashSessionId = randomUUID();
  const { data: legacyCashSession, error: legacyCashSessionError } =
    await adminIdentity.client
      .from("cash_sessions")
      .insert({
        closed_at: "2000-01-01T01:00:00.000Z",
        event_id: eventId,
        id: legacyCashSessionId,
        opened_at: forgedOpenedAt,
        opening_amount_in_cents: 500,
        operator_id: operatorBIdentity.userId,
        status: "closed",
      })
      .select("id,event_id,operator_id,opened_at,status,closed_at")
      .single();
  assert.equal(
    legacyCashSessionError,
    null,
    "the hardened legacy insert must remain compatible",
  );
  assert.equal(legacyCashSession.operator_id, adminIdentity.userId);
  assert.equal(legacyCashSession.event_id, eventId);
  assert.equal(legacyCashSession.status, "open");
  assert.equal(legacyCashSession.closed_at, null);
  assert.notEqual(legacyCashSession.opened_at, forgedOpenedAt);

  const timezoneCashSessionId = randomUUID();
  const { data: timezoneCashSession, error: timezoneCashSessionError } =
    await serviceClient
      .from("cash_sessions")
      .insert({
        closed_at: "2026-01-02T02:00:00.000Z",
        closed_by: operatorBIdentity.userId,
        counted_amount_in_cents: 0,
        difference_amount_in_cents: 0,
        event_id: null,
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

  const saleOperationId = randomUUID();
  const saleStartedAt = new Date();
  const { data: saleId, error: saleError } = await operatorAIdentity.client.rpc(
    "finalize_sale_v2",
    {
      p_items: [{ product_id: productId, quantity: 2 }],
      p_payment: {
        amount_in_cents: 2_500,
        change_in_cents: 500,
        method: "cash",
      },
      p_sale_id: saleOperationId,
    },
  );
  const saleFinishedAt = new Date();
  assert.equal(saleError, null, "the event-free sale must succeed");
  assert.equal(saleId, saleOperationId);

  const { data: retriedSaleId, error: retrySaleError } =
    await operatorAIdentity.client.rpc("finalize_sale_v2", {
      p_items: [{ product_id: productId, quantity: 2 }],
      p_payment: {
        amount_in_cents: 2_500,
        change_in_cents: 500,
        method: "cash",
      },
      p_sale_id: saleOperationId,
    });
  assert.equal(retrySaleError, null, "an identical sale retry must succeed");
  assert.equal(retriedSaleId, saleOperationId);

  const { error: divergentRetryError } = await operatorAIdentity.client.rpc(
    "finalize_sale_v2",
    {
      p_items: [{ product_id: productId, quantity: 1 }],
      p_payment: {
        amount_in_cents: 1_000,
        change_in_cents: 0,
        method: "pix",
      },
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
      "id,event_id,cash_session_id,operator_id,total_in_cents,completed_at,sale_items(quantity),payments(method,amount_in_cents,change_in_cents)",
    )
    .eq("id", saleId)
    .single();
  assert.equal(saleReadError, null, "operator A must read its own sale");
  assert.equal(sale.event_id, null);
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

  const legacySaleId = randomUUID();
  const forgedCompletedAt = "2000-01-01T00:00:00.000Z";
  const { data: finalizedLegacySaleId, error: legacySaleError } =
    await adminIdentity.client.rpc("finalize_sale", {
      p_cash_session_id: legacyCashSessionId,
      p_completed_at: forgedCompletedAt,
      p_event_id: eventId,
      p_items: [{ product_id: productId, quantity: 1 }],
      p_payment: {
        amount_in_cents: 1_000,
        change_in_cents: 0,
        method: "pix",
      },
      p_sale_id: legacySaleId,
      p_total_in_cents: 1_000,
    });
  assert.equal(legacySaleError, null, "legacy finalize_sale must keep working");
  assert.equal(finalizedLegacySaleId, legacySaleId);

  const { data: legacySale, error: legacySaleReadError } = await serviceClient
    .from("sales")
    .select("completed_at,event_id,operator_id")
    .eq("id", legacySaleId)
    .single();
  assert.equal(legacySaleReadError, null);
  assert.equal(legacySale.event_id, eventId);
  assert.equal(legacySale.operator_id, adminIdentity.userId);
  assert.notEqual(
    legacySale.completed_at,
    forgedCompletedAt,
    "the legacy sale row timestamp must be derived by the server",
  );

  const { error: directSaleError } = await operatorAIdentity.client
    .from("sales")
    .insert({
      cash_session_id: operatorACashSessionId,
      event_id: null,
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
    "open_cash_session_v2",
    { p_opening_amount_in_cents: 0 },
  );
  assert.ok(anonymousRpcError, "anonymous RPC execution must be blocked");

  const { error: banError } = await serviceClient.auth.admin.updateUserById(
    operatorBIdentity.userId,
    { ban_duration: "876000h" },
  );
  assert.equal(banError, null, "could not ban the test operator");

  const { error: bannedV2OpenError } = await operatorBIdentity.client.rpc(
    "open_cash_session_v2",
    { p_opening_amount_in_cents: 0 },
  );
  assert.match(
    bannedV2OpenError?.message ?? "",
    /active user/i,
    "a banned user must not open through the new RPC",
  );

  const { error: bannedLegacyOpenError } = await operatorBIdentity.client
    .from("cash_sessions")
    .insert({
      event_id: eventId,
      id: randomUUID(),
      opened_at: new Date().toISOString(),
      opening_amount_in_cents: 0,
      operator_id: operatorBIdentity.userId,
      status: "open",
    });
  assert.match(
    bannedLegacyOpenError?.message ?? "",
    /active user/i,
    "a banned user must not open through the legacy insert",
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

  const { data: reopenedCashSessionId, error: reopenError } =
    await operatorAIdentity.client.rpc("open_cash_session_v2", {
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
      .eq("id", reopenedCashSessionId)
      .single();
  assert.equal(reopenedReadError, null);
  assert.equal(
    reopenedCashSession.business_date,
    originalBusinessDate,
    "same-day reopenings must share the business date",
  );

  console.log(
    "Database integration passed: concurrency, RLS, RPCs, compatibility, and reopen.",
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
  return ["127.0.0.1", "::1", "localhost"].includes(hostname);
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

  if (productId) {
    await serviceClient
      .from("stock_movements")
      .delete()
      .eq("product_id", productId);
  }

  if (userIds.length > 0) {
    await serviceClient.from("sales").delete().in("operator_id", userIds);
    await serviceClient
      .from("cash_sessions")
      .delete()
      .in("operator_id", userIds);
  }

  if (productId) {
    await serviceClient.from("products").delete().eq("id", productId);
  }

  if (eventId) {
    await serviceClient.from("events").delete().eq("id", eventId);
  }

  if (inactiveEventId) {
    await serviceClient.from("events").delete().eq("id", inactiveEventId);
  }

  for (const userId of createdUserIds.reverse()) {
    await serviceClient.auth.admin.deleteUser(userId);
  }
}
