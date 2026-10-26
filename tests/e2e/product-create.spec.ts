import { expect, test } from "@playwright/test";
import {
  authenticatePage,
  createAuthenticatedSupabaseClient,
  getE2EUserCredentials,
} from "./support/auth";

test.beforeEach(async () => {
  getE2EUserCredentials();
});

test("admin creates a product and sees it in the products list", async ({
  page,
}) => {
  const uniqueSuffix = crypto.randomUUID();
  const productName = `Produto E2E ${uniqueSuffix}`;
  const productSku = `SKU-${uniqueSuffix}`.toUpperCase();
  const productSkuInput = ` sku-${uniqueSuffix.toLowerCase()} `;

  await authenticatePage(page);

  await page.goto("/products/new");
  await page.getByLabel("Nome do produto").fill(productName);
  await page.getByLabel("Preço").fill("35,00");
  await page.getByLabel("SKU").fill(productSkuInput);
  await page.getByLabel("Quantidade inicial em estoque").fill("12");
  await page.getByRole("button", { name: "Salvar produto" }).click();

  await expect(page.getByText("Produto cadastrado com sucesso.")).toBeVisible();

  await page.goto("/products");
  await page.getByLabel("Buscar produto").fill(productName);

  const productCard = page
    .getByRole("listitem")
    .filter({ hasText: productName });

  await expect(productCard).toBeVisible();
  await expect(productCard.getByText(productSku)).toBeVisible();
  await expect(productCard).not.toContainText(productSkuInput.trim());
  await expect(productCard.getByText("R$ 35,00")).toBeVisible();

  await page.goto("/stock");
  await page.locator("#stock-balance-search").fill(productSku);
  const balance = page.getByRole("link", {
    name: `${productName} (${productSku}) 12`,
    exact: true,
  });
  await expect(balance).toHaveCount(1);
  await expect(balance).toBeVisible();
  await page.reload();
  await page.locator("#stock-balance-search").fill(productSku);
  await expect(balance).toBeVisible();

  const client = await createAuthenticatedSupabaseClient("admin");
  const { data: product, error: productError } = await client
    .from("products")
    .select("id")
    .eq("sku", productSku)
    .single();
  expect(productError).toBeNull();
  expect(product).not.toBeNull();
  const { data: movements, error: movementError } = await client
    .from("stock_movements")
    .select("type,quantity_change")
    .eq("product_id", product!.id);
  expect(movementError).toBeNull();
  expect(movements).toEqual([
    { type: "initial_adjustment", quantity_change: 12 },
  ]);
  await expect(balance).toHaveAttribute(
    "href",
    `/products/${product!.id}/edit`,
  );
  await balance.click();
  await expect(page).toHaveURL(`/products/${product!.id}/edit`);
  await expect(page.getByLabel("Quantidade inicial em estoque")).toHaveCount(0);
});
