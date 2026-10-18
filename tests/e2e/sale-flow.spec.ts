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
    discount: "5,00",
    receivedAmount: "20,00",
  });
  await cancelLatestSale(page, productName, {
    discount: "R$ 5,00",
    subtotal: "R$ 15,00",
    total: "R$ 10,00",
  });

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

test("admin records discounted and full-price sales and closes cash with net reconciliation", async ({
  page,
}) => {
  await authenticatePage(page);
  const { productName } = await createTestProductWithStock(page, 4);
  const session = await openCashSessionThroughUi(page);

  await createSale(page, productName, {
    discount: "2,00",
    paymentMethodLabel: "Pix",
  });
  await createSale(page, productName, {
    paymentMethodLabel: "Cartão de crédito",
  });
  await createSale(page, productName, {
    discount: "5,00",
    receivedAmount: "20,00",
  });

  await page.goto("/cash/close");
  const cashCloseForm = cashSessionCloseForm(page, session.id);

  await expect(cashCloseForm).toContainText("Concluídas: 3");
  await expect(
    cashCloseForm.getByText("Valor inicial").locator(".."),
  ).toContainText("R$ 100,00");
  await expect(
    cashCloseForm.getByText("Vendas concluídas").locator(".."),
  ).toContainText("R$ 38,00");
  await expect(
    cashCloseForm.getByText("Esperado em dinheiro").locator(".."),
  ).toContainText("R$ 110,00");
  await expect(cashCloseForm.getByLabel("Senha administrativa")).toHaveCount(0);

  await closeCashSessionThroughUi(page, session.id, "110,00");
});

type CreateSaleOptions = {
  discount?: string;
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

  if (options.discount) {
    await page.getByLabel("Desconto (R$)").fill(options.discount);
  }

  const expectedTotal = options.discount
    ? 1500 - Math.round(Number(options.discount.replace(",", ".")) * 100)
    : 1500;

  if (options.paymentMethodLabel) {
    await page
      .getByRole("button", { name: options.paymentMethodLabel })
      .click();
    await expect(
      page.getByText(
        `${options.paymentMethodLabel} no valor de ${formatMoney(expectedTotal)}`,
      ),
    ).toBeVisible();
  } else {
    await page
      .getByLabel("Valor recebido")
      .fill(options.receivedAmount ?? "20,00");
    const receivedInCents = Math.round(
      Number((options.receivedAmount ?? "20,00").replace(",", ".")) * 100,
    );
    await expect(
      page.getByText(`Troco ${formatMoney(receivedInCents - expectedTotal)}`),
    ).toBeVisible();
  }

  await page.getByRole("button", { name: "Finalizar venda" }).click();

  await expect(page.getByText("Venda finalizada com sucesso.")).toBeVisible();
}

async function cancelLatestSale(
  page: Page,
  productName: string,
  amounts: { discount: string; subtotal: string; total: string },
) {
  await page.goto("/sales");
  const latestSaleLink = page
    .getByRole("link", { name: "Ver detalhes" })
    .first();
  const latestSale = latestSaleLink.locator("xpath=ancestor::li");
  await expect(
    latestSale.getByText("Subtotal", { exact: true }).locator(".."),
  ).toContainText(amounts.subtotal);
  await expect(
    latestSale.getByText("Desconto", { exact: true }).locator(".."),
  ).toContainText(amounts.discount);
  await expect(
    latestSale.getByText("Total líquido", { exact: true }).locator(".."),
  ).toContainText(amounts.total);
  await expect(latestSale.getByText(/Desconto concedido por/)).toBeVisible();
  await latestSaleLink.click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { level: 1, name: "Detalhe da venda" }),
  ).toBeVisible();
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
  await expect(
    page.getByText("Subtotal", { exact: true }).locator(".."),
  ).toContainText(amounts.subtotal);
  await expect(
    page.getByText("Desconto", { exact: true }).locator(".."),
  ).toContainText(amounts.discount);
  await expect(page.getByText(/Desconto concedido por/)).toBeVisible();
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

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(cents / 100);
}
