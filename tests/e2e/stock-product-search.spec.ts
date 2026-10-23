import { expect, test } from "@playwright/test";

import {
  authenticatePage,
  createAuthenticatedSupabaseClient,
  getE2EUserCredentials,
} from "./support/auth";
import { createTestProductWithStock } from "./support/store";

test.beforeEach(async () => {
  getE2EUserCredentials();
});

for (const width of [390, 768, 1440]) {
  test(`admin removes and adds stock with persisted history at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await authenticatePage(page);
    const { productId, productName } = await createTestProductWithStock(
      page,
      10,
    );
    await expect(
      page.getByRole("status", { name: "Estoque atual" }),
    ).toHaveText("Estoque atual: 10 unidades");
    for (const step of [
      { action: "Remover", quantity: "3", balance: 7 },
      { action: "Adicionar", quantity: "2", balance: 9 },
    ]) {
      await page.getByRole("radio", { name: new RegExp(step.action) }).check();
      await page.getByLabel("Quantidade", { exact: true }).fill(step.quantity);
      await expect(page.getByRole("status", { name: "Novo saldo" })).toHaveText(
        `Novo saldo: ${step.balance} unidades`,
      );
      const submit = page.getByRole("button", {
        name:
          step.action === "Remover"
            ? "Remover do estoque"
            : "Adicionar ao estoque",
      });
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const box = await submit.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      await testInfo.attach(`${step.action}-${width}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await submit.click();
      await expect(
        page.getByText("Estoque ajustado com sucesso."),
      ).toBeVisible();
      await expect(
        page.getByRole("status", { name: "Estoque atual" }),
      ).toHaveText(`Estoque atual: ${step.balance} unidades`);
      await page.reload();
      await page
        .getByRole("combobox", { name: "Buscar produto" })
        .fill(productName);
      await page.getByRole("option").filter({ hasText: productName }).click();
      await expect(
        page.getByRole("status", { name: "Estoque atual" }),
      ).toHaveText(`Estoque atual: ${step.balance} unidades`);
    }
    const client = await createAuthenticatedSupabaseClient();
    const { data, error } = await client
      .from("stock_movements")
      .select("quantity_change, type")
      .eq("product_id", productId);
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(data).toEqual(
      expect.arrayContaining(
        [10, -3, 2].map((quantity_change) => ({
          quantity_change,
          type: "manual_adjustment",
        })),
      ),
    );
  });
}

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
  await page.getByRole("button", { name: "Adicionar ao estoque" }).click();

  await expect(page.getByText("Estoque ajustado com sucesso.")).toBeVisible();
});
