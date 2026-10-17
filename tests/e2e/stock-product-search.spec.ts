import { expect, test } from "@playwright/test";

import { authenticatePage, getE2EUserCredentials } from "./support/auth";

test.beforeEach(async () => {
  getE2EUserCredentials();
});

test("admin searches, changes and selects a product before adjusting stock", async ({
  page,
}) => {
  const uniqueSuffix = crypto.randomUUID();
  const productName = `Calça Jeans E2E ${uniqueSuffix}`;
  const productSku = `JEANS-${uniqueSuffix}`.toUpperCase();

  await authenticatePage(page);
  await page.goto("/products/new");
  await page.getByLabel("Nome do produto").fill(productName);
  await page.getByLabel("Preço").fill("129,90");
  await page.getByLabel("SKU").fill(productSku);
  await page.getByRole("button", { name: "Salvar produto" }).click();

  await expect(page.getByText("Produto cadastrado com sucesso.")).toBeVisible();

  await page.goto("/stock");

  const productSearch = page.getByRole("combobox", {
    name: "Buscar produto",
  });
  const productId = page.locator('input[name="productId"]');

  await productSearch.fill("calca jeans");

  const productOption = page
    .getByRole("option")
    .filter({ hasText: productName });

  await expect(productOption).toBeVisible();
  await productOption.click();
  await expect(productId).not.toHaveValue("");
  await expect(
    page.getByRole("status", { name: "Produto selecionado" }),
  ).toContainText(productName);

  await page.getByRole("button", { name: "Trocar produto" }).click();
  await expect(productId).toHaveValue("");
  await expect(productSearch).toBeFocused();

  await productSearch.fill(productSku.toLowerCase());
  await expect(productOption).toBeVisible();
  await productOption.click();

  await page.getByLabel("Quantidade").fill("3");
  await page.getByRole("button", { name: "Registrar ajuste" }).click();

  await expect(page.getByText("Estoque ajustado com sucesso.")).toBeVisible();
});
