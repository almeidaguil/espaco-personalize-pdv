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
          {
            discountInCents: 500,
            payment: {
              amount_in_cents: 1000,
              change_in_cents: 0,
              method: "cash",
            },
          },
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
          { version: 3 },
        )
      ).error,
    ).toBeNull();
    const consolidated = await readAndAssertReport(admin.page, daily);
    expect(consolidated).toEqual({
      count: baseline.count + 2,
      discount: baseline.discount + 500,
      subtotal: baseline.subtotal + 3000,
      total: baseline.total + 2500,
    });
    const operatorA = await readAndAssertReport(
      admin.page,
      `${daily}&operatorId=${sessionA.operator_id}`,
    );
    expect(operatorA).toEqual({
      count: baselineA.count + 1,
      discount: baselineA.discount + 500,
      subtotal: baselineA.subtotal + 1500,
      total: baselineA.total + 1000,
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
      discount: baselineB.discount,
      subtotal: baselineB.subtotal + 1500,
      total: baselineB.total + 1500,
    });
    const operatorCsvB = await exportCsv(admin.page);
    expect(operatorCsvB).toContain(
      `Produto;${productB.productId};${productB.productName};1;15,00`,
    );
    expect(operatorCsvB).not.toContain(productA.productId);
    for (const [session, operatorName, included, excluded, expected] of [
      [
        sessionA,
        "E2E Operator A",
        productA,
        productB,
        { count: 1, discount: 500, subtotal: 1500, total: 1000 },
      ],
      [
        sessionB,
        "E2E Operator B",
        productB,
        productA,
        { count: 1, discount: 0, subtotal: 1500, total: 1500 },
      ],
    ] as const) {
      const summary = await readAndAssertReport(
        admin.page,
        `${daily}&cashSessionId=${session.id}`,
      );
      expect(summary).toEqual(expected);
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
      expect(csv).toContain(
        `Desconto do caixa;${session.id};${operatorName};;${formatCsvMoney(expected.discount)}`,
      );
      expect(csv).toContain(
        `Líquido do caixa;${session.id};${operatorName};1;${formatCsvMoney(expected.total)}`,
      );
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
          {
            discountInCents: 500,
            payment: {
              amount_in_cents: 1200,
              change_in_cents: 200,
              method: "cash",
            },
          },
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
          { version: 3 },
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
      p_counted_amount_in_cents: 10900,
      p_closed_at: new Date().toISOString(),
      p_admin_password: adminPassword,
    });
    expect(close.error).toBeNull();
    const { data: sales, error: saleError } = await adminClient
      .from("sales")
      .select(
        "id,status,canceled_after_cash_close,operator_id,subtotal_in_cents,discount_in_cents,total_in_cents",
      )
      .in("id", [completedSaleId, canceledSaleId]);
    expect(saleError).toBeNull();
    expect(sales).toHaveLength(2);
    expect(sales).toEqual(
      expect.arrayContaining([
        {
          id: completedSaleId,
          status: "completed",
          canceled_after_cash_close: false,
          discount_in_cents: 500,
          operator_id: session.operator_id,
          subtotal_in_cents: 1500,
          total_in_cents: 1000,
        },
        {
          id: canceledSaleId,
          status: "canceled",
          canceled_after_cash_close: false,
          discount_in_cents: 0,
          operator_id: session.operator_id,
          subtotal_in_cents: 1500,
          total_in_cents: 1500,
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
      expected_amount_in_cents: 11000,
      difference_amount_in_cents: -100,
    });

    const date = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date(session.opened_at));
    const summary = await readAndAssertReport(
      admin.page,
      `startDate=${date}&endDate=${date}&cashSessionId=${session.id}`,
    );
    expect(summary).toEqual({
      count: 1,
      discount: 500,
      subtotal: 1500,
      total: 1000,
    });
    const canceledCard = admin.page.locator("dl > div").filter({
      has: admin.page.locator("dt", { hasText: /^Vendas canceladas$/ }),
    });
    await expect(canceledCard.locator("dd")).toHaveText("1 (R$ 15,00)");
    const revenueCard = admin.page.locator("dl > div").filter({
      has: admin.page.locator("dt", { hasText: /^Receita líquida$/ }),
    });
    await expect(revenueCard.locator("dd")).toHaveText("R$ 10,00");
    const shortageCard = admin.page
      .locator("dl > div")
      .filter({ has: admin.page.locator("dt", { hasText: /^Faltas$/ }) });
    await expect(shortageCard.locator("dd")).toHaveText("R$ 1,00");
    const differenceCard = admin.page.locator("dl > div").filter({
      has: admin.page.locator("dt", { hasText: /^Diferença líquida$/ }),
    });
    await expect(differenceCard.locator("dd")).toHaveText("-R$ 1,00");
    const csv = await exportCsv(admin.page);
    expect(csv).toContain("Resumo;vendas_brutas;Vendas brutas;1;15,00");
    expect(csv).toContain(
      "Resumo;descontos_concedidos;Descontos concedidos;;5,00",
    );
    expect(csv).toContain("Resumo;vendas_liquidas;Vendas líquidas;1;10,00");
    expect(csv).toContain(
      "Resumo;vendas_canceladas;Vendas canceladas (fora da receita);1;15,00",
    );
    expect(csv).toContain(
      "Resumo;receita_liquida;Receita líquida após ajustes pós-fechamento;;10,00",
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
  const gross = readCsvSummary(csv, "vendas_brutas");
  const discountSummary = readCsvSummary(csv, "descontos_concedidos");
  const net = readCsvSummary(csv, "vendas_liquidas");
  const count = Number(net[3]);
  const subtotal = parseMoney(gross[4]);
  const discount = parseMoney(discountSummary[4]);
  const total = parseMoney(net[4]);
  expect(Number(gross[3])).toBe(count);
  expect(subtotal - discount).toBe(total);
  const grossCard = page
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: /^Vendas brutas$/ }) });
  await expect(grossCard.locator("dd")).toHaveText(formatMoney(subtotal));
  const discountCard = page.locator("dl > div").filter({
    has: page.locator("dt", { hasText: /^Descontos concedidos$/ }),
  });
  await expect(discountCard.locator("dd")).toHaveText(formatMoney(discount));
  const netCard = page
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: /^Vendas líquidas$/ }) });
  await expect(netCard.locator("dd")).toHaveText(
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
  return { count, discount, subtotal, total };
}

function readCsvSummary(csv: string, identifier: string) {
  const summary = csv
    .split("\n")
    .find((line) => line.startsWith(`Resumo;${identifier};`))
    ?.split(";");
  if (!summary) throw new Error(`${identifier} CSV summary is required.`);
  return summary;
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

function formatCsvMoney(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}
