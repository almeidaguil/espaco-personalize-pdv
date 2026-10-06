import { expect, test } from "@playwright/test";
import { authenticatePage, getE2EUserCredentials } from "./support/auth";

test.beforeEach(async () => {
  getE2EUserCredentials();
});

test("admin creates a product and sees it in the products list", async ({
  page,
}) => {
  const uniqueSuffix = crypto.randomUUID();
  const productName = `Produto E2E ${uniqueSuffix}`;
  const productSku = `E2E-${uniqueSuffix}`;

  await authenticatePage(page);

  await page.goto("/products/new");
  await page.getByLabel("Nome do produto").fill(productName);
  await page.getByLabel("Preço").fill("35,00");
  await page.getByLabel("SKU").fill(productSku);
  await page.getByRole("button", { name: "Salvar produto" }).click();

  await expect(page.getByText("Produto cadastrado com sucesso.")).toBeVisible();

  await page.goto("/products");
  await page.getByLabel("Buscar produto").fill(productName);

  const productCard = page
    .getByRole("listitem")
    .filter({ hasText: productName });

  await expect(productCard).toBeVisible();
  await expect(productCard.getByText(productSku)).toBeVisible();
  await expect(productCard.getByText("R$ 35,00")).toBeVisible();
});
