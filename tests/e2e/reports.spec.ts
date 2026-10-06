import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

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
