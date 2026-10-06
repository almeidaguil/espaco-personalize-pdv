import { expect, type Page, test } from "@playwright/test";
import { authenticatePage, getE2EUserCredentials } from "./support/auth";
import {
  cashSessionCloseForm,
  closeCashSessionThroughUi,
  closeOwnOpenCashSession,
  openCashSessionThroughUi,
} from "./support/cash";

test.beforeEach(async () => {
  getE2EUserCredentials();
  await closeOwnOpenCashSession();
});
test.afterEach(async () => {
  await closeOwnOpenCashSession();
});

test("admin creates and cancels a sale restoring stock", async ({ page }) => {
  const uniqueSuffix = crypto.randomUUID();
  const productName = `Venda E2E Produto ${uniqueSuffix}`;
  const productSku = `VENDA-E2E-${uniqueSuffix.slice(0, 8)}`;

  await authenticatePage(page);
  await createProduct(page, productName, productSku);
  await addInitialStock(page, productName, 3);
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
  const uniqueSuffix = crypto.randomUUID();
  const productName = `Pagamento E2E Produto ${uniqueSuffix}`;
  const productSku = `PAG-E2E-${uniqueSuffix.slice(0, 8)}`;

  await authenticatePage(page);
  await createProduct(page, productName, productSku);
  await addInitialStock(page, productName, 4);
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

async function createProduct(page: Page, productName: string, sku: string) {
  await page.goto("/products/new");
  await page.getByLabel("Nome do produto").fill(productName);
  await page.locator("#priceInReais").fill("15,00");
  await page.getByLabel("SKU").fill(sku);
  await page.getByRole("button", { name: "Salvar produto" }).click();

  await expect(page.getByText("Produto cadastrado com sucesso.")).toBeVisible();
}

async function addInitialStock(
  page: Page,
  productName: string,
  quantity: number,
) {
  await page.goto("/stock");

  const productOptionValue = await page
    .locator("select#productId option", { hasText: productName })
    .getAttribute("value");

  expect(productOptionValue).not.toBeNull();

  await page
    .getByLabel("Produto", { exact: true })
    .selectOption(productOptionValue ?? "");
  await page.getByLabel("Quantidade").fill(String(quantity));
  await page.getByRole("button", { name: "Registrar ajuste" }).click();

  await expect(page.getByText("Estoque ajustado com sucesso.")).toBeVisible();
}

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
