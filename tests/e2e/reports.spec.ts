import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

import {
  createAuthenticatedPage,
  createAuthenticatedSupabaseClient,
  getE2EUserCredentials,
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

test("relatorio diario consolida vendas reais e preserva filtros e totais no CSV", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const admin = await createAuthenticatedPage(browser, "admin");
  const a = await createAuthenticatedPage(browser, "operatorA");
  const b = await createAuthenticatedPage(browser, "operatorB");
  try {
    const clientA = await createAuthenticatedSupabaseClient("operatorA");
    const clientB = await createAuthenticatedSupabaseClient("operatorB");
    const productA = await createTestProductWithStock(admin.page, 1);
    const productB = await createTestProductWithStock(admin.page, 1);
    const sessionA = await openCashSessionThroughUi(a.page, "operatorA");
    const sessionB = await openCashSessionThroughUi(b.page, "operatorB");
    const date = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date(sessionA.opened_at));
    expect(
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date(sessionB.opened_at)),
    ).toBe(date);
    const daily = `startDate=${date}&endDate=${date}`;
    // Preserve audit history and assert the known incremental sales against the pre-sale day.
    const baseline = await readAndAssertReport(admin.page, daily);
    const baselineA = await readAndAssertReport(
      admin.page,
      `${daily}&operatorId=${sessionA.operator_id}`,
    );
    const baselineB = await readAndAssertReport(
      admin.page,
      `${daily}&operatorId=${sessionB.operator_id}`,
    );
    expect(
      (
        await finalizeSale(
          clientA,
          sessionA.id,
          productA.productId,
          randomUUID(),
        )
      ).error,
    ).toBeNull();
    expect(
      (
        await finalizeSale(
          clientB,
          sessionB.id,
          productB.productId,
          randomUUID(),
        )
      ).error,
    ).toBeNull();
    const consolidated = await readAndAssertReport(admin.page, daily);
    expect(consolidated).toEqual({
      count: baseline.count + 2,
      total: baseline.total + 3000,
    });
    const operatorA = await readAndAssertReport(
      admin.page,
      `${daily}&operatorId=${sessionA.operator_id}`,
    );
    expect(operatorA).toEqual({
      count: baselineA.count + 1,
      total: baselineA.total + 1500,
    });
    // Operator history may span several item pages; the full CSV must include only this operator's fixture.
    const operatorCsvA = await exportCsv(admin.page);
    expect(operatorCsvA).toContain(
      `Produto;${productA.productId};${productA.productName};1;15,00`,
    );
    expect(operatorCsvA).not.toContain(productB.productId);
    const operatorB = await readAndAssertReport(
      admin.page,
      `${daily}&operatorId=${sessionB.operator_id}`,
    );
    expect(operatorB).toEqual({
      count: baselineB.count + 1,
      total: baselineB.total + 1500,
    });
    const operatorCsvB = await exportCsv(admin.page);
    expect(operatorCsvB).toContain(
      `Produto;${productB.productId};${productB.productName};1;15,00`,
    );
    expect(operatorCsvB).not.toContain(productA.productId);
    for (const [session, included, excluded] of [
      [sessionA, productA, productB],
      [sessionB, productB, productA],
    ] as const) {
      const summary = await readAndAssertReport(
        admin.page,
        `${daily}&cashSessionId=${session.id}`,
      );
      expect(summary).toEqual({ count: 1, total: 1500 });
      await expect(
        admin.page.getByText(included.productName, { exact: true }),
      ).toBeVisible();
      await expect(
        admin.page.getByText(excluded.productName, { exact: true }),
      ).toHaveCount(0);
      const csv = await exportCsv(admin.page);
      expect(csv).toContain(
        `Produto;${included.productId};${included.productName};1;15,00`,
      );
      expect(csv).not.toContain(excluded.productId);
      expect(csv).toContain(`Caixa;${session.id};`);
    }
  } finally {
    await admin.context.close();
    await a.context.close();
    await b.context.close();
  }
});

test("relatorio exclui venda cancelada da receita e exporta a divergencia do caixa fechado", async ({
  browser,
}) => {
  const admin = await createAuthenticatedPage(browser, "admin");
  const operator = await createAuthenticatedPage(browser, "operatorA");
  try {
    const seller = await createAuthenticatedSupabaseClient("operatorA");
    const product = await createTestProductWithStock(admin.page, 2);
    const session = await openCashSessionThroughUi(operator.page, "operatorA");
    const completedSaleId = randomUUID();
    const canceledSaleId = randomUUID();
    expect(
      (
        await finalizeSale(
          seller,
          session.id,
          product.productId,
          completedSaleId,
        )
      ).error,
    ).toBeNull();
    expect(
      (
        await finalizeSale(
          seller,
          session.id,
          product.productId,
          canceledSaleId,
        )
      ).error,
    ).toBeNull();

    const adminClient = await createAuthenticatedSupabaseClient("admin");
    const adminPassword = getE2EUserCredentials("admin").password;
    const cancellation = await adminClient.rpc("cancel_sale", {
      p_sale_id: canceledSaleId,
      p_canceled_at: new Date().toISOString(),
      p_admin_password: adminPassword,
    });
    expect(cancellation.error).toBeNull();
    // Cancel while open: it must leave revenue and cash reconciliation, not create a post-close adjustment.
    const close = await seller.rpc("close_cash_session", {
      p_cash_session_id: session.id,
      p_counted_amount_in_cents: 11400,
      p_closed_at: new Date().toISOString(),
      p_admin_password: adminPassword,
    });
    expect(close.error).toBeNull();
    const { data: sales, error: saleError } = await adminClient
      .from("sales")
      .select("id,status,canceled_after_cash_close")
      .in("id", [completedSaleId, canceledSaleId]);
    expect(saleError).toBeNull();
    expect(sales).toHaveLength(2);
    expect(sales).toEqual(
      expect.arrayContaining([
        {
          id: completedSaleId,
          status: "completed",
          canceled_after_cash_close: false,
        },
        {
          id: canceledSaleId,
          status: "canceled",
          canceled_after_cash_close: false,
        },
      ]),
    );
    const { data: closed, error: cashError } = await adminClient
      .from("cash_sessions")
      .select(
        "status,closed_by,expected_amount_in_cents,difference_amount_in_cents",
      )
      .eq("id", session.id)
      .single();
    expect(cashError).toBeNull();
    expect(closed).toMatchObject({
      status: "closed",
      closed_by: session.operator_id,
      expected_amount_in_cents: 11500,
      difference_amount_in_cents: -100,
    });

    const date = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date(session.opened_at));
    const summary = await readAndAssertReport(
      admin.page,
      `startDate=${date}&endDate=${date}&cashSessionId=${session.id}`,
    );
    expect(summary).toEqual({ count: 1, total: 1500 });
    const canceledCard = admin.page.locator("dl > div").filter({
      has: admin.page.locator("dt", { hasText: /^Vendas canceladas$/ }),
    });
    await expect(canceledCard.locator("dd")).toHaveText("1 (R$ 15,00)");
    const revenueCard = admin.page.locator("dl > div").filter({
      has: admin.page.locator("dt", { hasText: /^Receita líquida$/ }),
    });
    await expect(revenueCard.locator("dd")).toHaveText("R$ 15,00");
    const shortageCard = admin.page
      .locator("dl > div")
      .filter({ has: admin.page.locator("dt", { hasText: /^Faltas$/ }) });
    await expect(shortageCard.locator("dd")).toHaveText("R$ 1,00");
    const differenceCard = admin.page.locator("dl > div").filter({
      has: admin.page.locator("dt", { hasText: /^Diferença líquida$/ }),
    });
    await expect(differenceCard.locator("dd")).toHaveText("-R$ 1,00");
    const csv = await exportCsv(admin.page);
    expect(csv).toContain("Resumo;vendas_concluidas;Vendas concluídas;1;15,00");
    expect(csv).toContain(
      "Resumo;vendas_canceladas;Vendas canceladas (fora da receita);1;15,00",
    );
    expect(csv).toContain(
      "Resumo;receita_liquida;Receita líquida após ajustes pós-fechamento;;15,00",
    );
    expect(csv).toContain(
      "Resumo;falta_caixa;Falta apurada em caixas fechados;;1,00",
    );
    expect(csv).toContain(
      "Resumo;diferenca_liquida_caixa;Diferença líquida dos caixas fechados;;-1,00",
    );
    expect(csv).toContain(
      `Divergência de caixa;${session.id};E2E Operator A;;-1,00`,
    );
    expect(csv).toContain(
      `Produto;${product.productId};${product.productName};1;15,00`,
    );
  } finally {
    await admin.context.close();
    await operator.context.close();
  }
});

async function exportCsv(page: Page) {
  const href = await page
    .getByRole("link", { name: "Exportar CSV" })
    .getAttribute("href");
  if (!href) throw new Error("Report CSV export link is required.");
  const response = await page.request.get(href);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  return response.text();
}

async function readAndAssertReport(page: Page, query: string) {
  await page.goto(`/reports?${query}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Relatórios" }),
  ).toBeVisible();
  const href = await page
    .getByRole("link", { name: "Exportar CSV" })
    .getAttribute("href");
  const exported = new URL(href ?? "", "http://localhost").searchParams;
  for (const [key, value] of new URLSearchParams(query))
    expect(exported.get(key)).toBe(value);
  const csv = await exportCsv(page);
  const completed = csv
    .split("\n")
    .find((line) => line.startsWith("Resumo;vendas_concluidas;"))
    ?.split(";");
  if (!completed) throw new Error("Completed-sales CSV summary is required.");
  const count = Number(completed[3]);
  const total = parseMoney(completed[4]);
  const summary = page
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: /^Vendas reconhecidas$/ }) });
  await expect(summary.locator("dd")).toHaveText(
    `${count} (${formatMoney(total)})`,
  );
  const revenue = csv
    .split("\n")
    .find((line) => line.startsWith("Resumo;receita_liquida;"))
    ?.split(";");
  if (!revenue) throw new Error("Net-revenue CSV summary is required.");
  const revenueCard = page
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: /^Receita líquida$/ }) });
  await expect(revenueCard.locator("dd")).toHaveText(
    formatMoney(parseMoney(revenue[4])),
  );
  return { count, total };
}

function parseMoney(value: string) {
  expect(value).toMatch(/^-?\d+,\d{2}$/);
  return Math.round(Number(value.replace(",", ".")) * 100);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
