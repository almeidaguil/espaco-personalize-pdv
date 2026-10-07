import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import {
  createAuthenticatedPage,
  createAuthenticatedSupabaseClient,
} from "./support/auth";
import {
  closeOwnOpenCashSession,
  openCashSessionThroughUi,
} from "./support/cash";
import { createTestProductWithStock, finalizeSale } from "./support/store";

test.beforeEach(async () => {
  await closeOwnOpenCashSession("operatorA");
  await closeOwnOpenCashSession("operatorB");
});

test.afterEach(async () => {
  await closeOwnOpenCashSession("operatorA");
  await closeOwnOpenCashSession("operatorB");
});

test("dois operadores disputam a ultima unidade sem duplicar venda ou estoque", async ({
  browser,
}) => {
  const admin = await createAuthenticatedPage(browser, "admin");
  const a = await createAuthenticatedPage(browser, "operatorA");
  const b = await createAuthenticatedPage(browser, "operatorB");
  try {
    const reader = await createAuthenticatedSupabaseClient("admin");
    const clientA = await createAuthenticatedSupabaseClient("operatorA");
    const clientB = await createAuthenticatedSupabaseClient("operatorB");
    const product = await createTestProductWithStock(admin.page, 1);
    const sessionA = await openCashSessionThroughUi(a.page, "operatorA");
    const sessionB = await openCashSessionThroughUi(b.page, "operatorB");
    expect(sessionA.id).not.toBe(sessionB.id);
    expect(sessionA.operator_id).not.toBe(sessionB.operator_id);
    const saleIds = [randomUUID(), randomUUID()];
    const results = await Promise.all([
      finalizeSale(clientA, sessionA.id, product.productId, saleIds[0]),
      finalizeSale(clientB, sessionB.id, product.productId, saleIds[1]),
    ]);
    expect(results.filter(({ error }) => error === null)).toHaveLength(1);
    const failures = results.filter(({ error }) => error !== null);
    expect(failures).toHaveLength(1);
    expect(failures[0].error?.message).toContain("Insufficient stock");
    const { data: sales, error } = await reader
      .from("sales")
      .select("id,operator_id,cash_session_id,status,total_in_cents")
      .in("id", saleIds);
    expect(error).toBeNull();
    expect(sales).toHaveLength(1);
    const winner = results.findIndex(({ error }) => error === null);
    const winnerSession = [sessionA, sessionB][winner];
    expect(sales?.[0]).toMatchObject({
      id: saleIds[winner],
      operator_id: winnerSession.operator_id,
      cash_session_id: winnerSession.id,
      status: "completed",
      total_in_cents: 1500,
    });
    const { data: movements, error: stockError } = await reader
      .from("stock_movements")
      .select("quantity_change,sale_id")
      .eq("product_id", product.productId);
    expect(stockError).toBeNull();
    expect(movements?.reduce((sum, row) => sum + row.quantity_change, 0)).toBe(
      0,
    );
    expect(movements?.filter(({ sale_id }) => sale_id !== null)).toEqual([
      { quantity_change: -1, sale_id: saleIds[winner] },
    ]);
    const { data: payments, error: paymentError } = await reader
      .from("payments")
      .select("sale_id,amount_in_cents")
      .in("sale_id", saleIds);
    expect(paymentError).toBeNull();
    expect(payments).toEqual([
      { sale_id: saleIds[winner], amount_in_cents: 1500 },
    ]);
  } finally {
    await admin.context.close();
    await a.context.close();
    await b.context.close();
  }
});

test("venda e fechamento concorrentes mantem reconciliacao e autoria", async ({
  browser,
}) => {
  const admin = await createAuthenticatedPage(browser, "admin");
  const operator = await createAuthenticatedPage(browser, "operatorA");
  try {
    const reader = await createAuthenticatedSupabaseClient("admin");
    const seller = await createAuthenticatedSupabaseClient("operatorA");
    // Distinct connections exercise transaction serialization for the same identity.
    const closer = await createAuthenticatedSupabaseClient("operatorA");
    const product = await createTestProductWithStock(admin.page, 1);
    const session = await openCashSessionThroughUi(operator.page, "operatorA");
    const saleId = randomUUID();
    const [sale, close] = await Promise.all([
      finalizeSale(seller, session.id, product.productId, saleId),
      closer.rpc("close_cash_session", {
        p_cash_session_id: session.id,
        p_counted_amount_in_cents: 11500,
        p_closed_at: new Date().toISOString(),
      }),
    ]);
    expect(close.error).toBeNull();
    const { data: closed, error } = await reader
      .from("cash_sessions")
      .select(
        "status,closed_by,expected_amount_in_cents,difference_amount_in_cents",
      )
      .eq("id", session.id)
      .single();
    expect(error).toBeNull();
    expect(closed).toMatchObject({
      status: "closed",
      closed_by: session.operator_id,
    });
    const { data: sales, error: saleError } = await reader
      .from("sales")
      .select("id,operator_id,cash_session_id")
      .eq("id", saleId);
    expect(saleError).toBeNull();
    const { data: movements, error: stockError } = await reader
      .from("stock_movements")
      .select("quantity_change")
      .eq("product_id", product.productId);
    expect(stockError).toBeNull();
    if (sale.error === null) {
      expect(sales).toEqual([
        {
          id: saleId,
          operator_id: session.operator_id,
          cash_session_id: session.id,
        },
      ]);
      expect(closed).toMatchObject({
        expected_amount_in_cents: 11500,
        difference_amount_in_cents: 0,
      });
      expect(
        movements?.reduce((sum, row) => sum + row.quantity_change, 0),
      ).toBe(0);
    } else {
      expect(sale.error.message).toContain("There is no open cash session");
      expect(sales).toEqual([]);
      expect(closed).toMatchObject({
        expected_amount_in_cents: 10000,
        difference_amount_in_cents: 1500,
      });
      expect(
        movements?.reduce((sum, row) => sum + row.quantity_change, 0),
      ).toBe(1);
    }
    const lateSaleId = randomUUID();
    const lateSale = await finalizeSale(
      seller,
      session.id,
      product.productId,
      lateSaleId,
    );
    expect(lateSale.error?.message).toContain("There is no open cash session");
    const { count, error: lateError } = await reader
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("id", lateSaleId);
    expect(lateError).toBeNull();
    expect(count).toBe(0);
  } finally {
    await admin.context.close();
    await operator.context.close();
  }
});

test("vendas normais pertencem ao caixa do respectivo operador", async ({
  browser,
}) => {
  const admin = await createAuthenticatedPage(browser, "admin");
  const a = await createAuthenticatedPage(browser, "operatorA");
  const b = await createAuthenticatedPage(browser, "operatorB");
  try {
    const reader = await createAuthenticatedSupabaseClient("admin");
    const clientA = await createAuthenticatedSupabaseClient("operatorA");
    const clientB = await createAuthenticatedSupabaseClient("operatorB");
    const product = await createTestProductWithStock(admin.page, 2);
    const sessionA = await openCashSessionThroughUi(a.page, "operatorA");
    const sessionB = await openCashSessionThroughUi(b.page, "operatorB");
    const saleA = randomUUID();
    const saleB = randomUUID();
    expect(
      (await finalizeSale(clientA, sessionA.id, product.productId, saleA))
        .error,
    ).toBeNull();
    expect(
      (await finalizeSale(clientB, sessionB.id, product.productId, saleB))
        .error,
    ).toBeNull();
    const { data, error } = await reader
      .from("sales")
      .select("id,operator_id,cash_session_id")
      .in("id", [saleA, saleB]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data).toEqual(
      expect.arrayContaining([
        {
          id: saleA,
          operator_id: sessionA.operator_id,
          cash_session_id: sessionA.id,
        },
        {
          id: saleB,
          operator_id: sessionB.operator_id,
          cash_session_id: sessionB.id,
        },
      ]),
    );
  } finally {
    await admin.context.close();
    await a.context.close();
    await b.context.close();
  }
});
