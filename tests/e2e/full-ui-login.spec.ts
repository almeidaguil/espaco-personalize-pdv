import { expect, test } from "@playwright/test";
import { getE2EUserCredentials } from "./support/auth";
import {
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

test("admin logs in through the UI and traverses main flows", async ({
  page,
}) => {
  const uniqueSuffix = crypto.randomUUID();
  const productName = `E2E UI Produto ${uniqueSuffix}`;
  const productSku = `E2E-UI-${uniqueSuffix}`;

  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "E-mail" })
    .fill(getE2EUserCredentials().email);
  await page.getByLabel("Senha").fill(getE2EUserCredentials().password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Caixa aberto|Caixa fechado/,
    }),
  ).toBeVisible();

  await page.goto("/products/new");
  await page.getByLabel("Nome do produto").fill(productName);
  await page.locator("#priceInReais").fill("42,00");
  await page.getByLabel("SKU").fill(productSku);
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByText("Produto cadastrado com sucesso.")).toBeVisible();

  await page.goto("/products");
  await expect(page.getByText(productName)).toBeVisible();

  const session = await openCashSessionThroughUi(page);

  await page.goto("/pdv");
  await expect(
    page.getByRole("heading", { level: 1, name: "PDV" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Caixa aberto para venda" }),
  ).toBeVisible();

  await closeCashSessionThroughUi(page, session.id);
});
