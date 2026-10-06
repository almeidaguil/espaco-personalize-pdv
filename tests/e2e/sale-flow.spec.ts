import { expect, type Page, test } from "@playwright/test";
import { authenticatePage, getE2EUserCredentials } from "./support/auth";
import {
  cashSessionCloseForm,
  closeCashSessionThroughUi,
  closeOwnOpenCashSession,
  openCashSessionThroughUi,
} from "./support/cash";
import { createTestProductWithStock } from "./support/store";

test.beforeEach(async () => {
  getE2EUserCredentials();
  await closeOwnOpenCashSession();
});
test.afterEach(async () => {
  await closeOwnOpenCashSession();
});

test("admin creates and cancels a sale restoring stock", async ({ page }) => {
  await authenticatePage(page);
  const { productName } = await createTestProductWithStock(page, 3);
  await openCashSessionThroughUi(page);
  await createSale(page, productName, {
    receivedAmount: "20,00",
  });
  await cancelLatestSale(page, productName);

  await page.goto("/stock");
  const balanceItem = page
    .locator("article", { hasText: productName })
    .filter({ hasText: "3" })
    .first();

  await expect(balanceItem).toBeVisible();
  await expect(
    page
      .locator("article", { hasText: productName })
      .filter({ hasText: "Cancelamento de venda" })
      .first(),
  ).toBeVisible();
});

test("admin records non-cash sales and closes cash with reconciliation", async ({
  page,
}) => {
  await authenticatePage(page);
  const { productName } = await createTestProductWithStock(page, 4);
  const session = await openCashSessionThroughUi(page);

  await createSale(page, productName, {
    paymentMethodLabel: "Pix",
  });
  await createSale(page, productName, {
    paymentMethodLabel: "Cartão de crédito",
  });

  await page.goto("/cash/close");
  const cashCloseForm = cashSessionCloseForm(page, session.id);

  await expect(cashCloseForm).toContainText("Concluídas: 2");
  await expect(cashCloseForm).toContainText("R$ 100,00");
  await expect(cashCloseForm.getByLabel("Senha administrativa")).toHaveCount(0);

  await closeCashSessionThroughUi(page, session.id);
});

type CreateSaleOptions = {
  paymentMethodLabel?: "Cartão de crédito" | "Cartão de débito" | "Pix";
  receivedAmount?: string;
};

async function createSale(
  page: Page,
  productName: string,
  options: CreateSaleOptions = {},
) {
  await page.goto("/pdv", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Caixa aberto para venda" }),
  ).toBeVisible();
  await expect(page.getByLabel("Caixa da venda")).toHaveCount(0);

  await page.getByLabel("Buscar produto").fill(productName);
  await expect(page.getByText("1 produto(s) encontrado(s)")).toBeVisible();
  await page
    .locator("article", { hasText: productName })
    .getByRole("button", { name: "Adicionar" })
    .click();
  await expect(page.locator("li", { hasText: productName })).toBeVisible();

  if (options.paymentMethodLabel) {
    await page
      .getByRole("button", { name: options.paymentMethodLabel })
      .click();
    await expect(
      page.getByText(`${options.paymentMethodLabel} no valor de R$ 15,00`),
    ).toBeVisible();
  } else {
    await page
      .getByLabel("Valor recebido")
      .fill(options.receivedAmount ?? "20,00");
    await expect(page.getByText("Troco R$ 5,00")).toBeVisible();
  }

  await page.getByRole("button", { name: "Finalizar venda" }).click();

  await expect(page.getByText("Venda finalizada com sucesso.")).toBeVisible();
}

async function cancelLatestSale(page: Page, productName: string) {
  await page.goto("/sales");
  await page.getByRole("link", { name: "Ver detalhes" }).first().click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { level: 1, name: "Detalhe da venda" }),
  ).toBeVisible();
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: /Confirmo que esta venda deve ser cancelada/,
    })
    .check();
  await page
    .getByLabel("Senha administrativa")
    .fill(getE2EUserCredentials().password);
  await page.getByRole("button", { name: "Cancelar venda" }).click();

  await expect(page.getByText("Venda cancelada com sucesso.")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Venda cancelada" }),
  ).toBeDisabled();
  await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
}
