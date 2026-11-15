import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  authenticatePage,
  createAuthenticatedSupabaseClient,
  createAuthenticatedPage,
  getE2EUserCredentials,
} from "./support/auth";

test.beforeEach(async () => {
  getE2EUserCredentials();
});

for (const width of [390, 768, 1440]) {
  test(`admin persists, edits and clears product description at ${width}px`, async ({
    page,
  }, testInfo) => {
    const uniqueSuffix = crypto.randomUUID();
    const productName = `Produto E2E ${uniqueSuffix}`;
    const productSku = `SKU-${uniqueSuffix}`.toUpperCase();
    const productSkuInput = ` sku-${uniqueSuffix.toLowerCase()} `;

    await page.setViewportSize({ width, height: 900 });
    await authenticatePage(page);

    await page.goto("/products/new");
    await page.getByLabel("Nome do produto").fill(productName);
    const description = `Algodão\n${"Detalhes ".repeat(100)}${"x".repeat(500)}`;
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Descrição")).toBeFocused();
    await page.getByLabel("Descrição").fill(description);
    await expect(page.getByLabel("Descrição")).not.toHaveCSS(
      "box-shadow",
      "none",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include("form")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await expect(page.getByLabel("Descrição")).not.toHaveAttribute("required");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel("Preço").fill("35,00");
    await page.getByLabel("SKU").fill(productSkuInput);
    await testInfo.attach(`new-${width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await page.getByLabel("Quantidade inicial em estoque").fill("12");
    await page.getByRole("button", { name: "Salvar produto" }).click();

    await expect(
      page.getByText("Produto cadastrado com sucesso."),
    ).toBeVisible();

    await page.goto("/products");
    await page.getByLabel("Buscar produto").fill(productName);

    const productCard = page
      .getByRole("listitem")
      .filter({ hasText: productName });

    await expect(productCard).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(productCard.getByText("R$ 35,00")).toHaveCSS(
      "font-weight",
      "700",
    );
    await testInfo.attach(`list-${width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await expect(productCard.getByText(productSku)).toBeVisible();
    await expect(productCard).not.toContainText(productSkuInput.trim());
    await expect(productCard.getByText("R$ 35,00")).toBeVisible();

    await productCard.getByRole("link", { name: "Editar" }).click();
    await page.waitForURL(/\/products\/[^/]+\/edit$/);
    await expect(page.locator("#description")).toHaveValue(description);
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
      .select("id,description")
      .eq("sku", productSku)
      .single();
    expect(productError).toBeNull();
    expect(product).not.toBeNull();
    expect(product!.description).toBe(description);
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
    await expect(page.getByLabel("Quantidade inicial em estoque")).toHaveCount(
      0,
    );
    await expect(page.getByLabel("Descrição")).toHaveValue(description);
    expect(
      (
        await new AxeBuilder({ page })
          .include("form")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await testInfo.attach(`edit-${width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    for (const updatedDescription of ["Nova descrição\nManga curta", ""]) {
      await page.getByLabel("Descrição").fill(updatedDescription);
      const save = page.getByRole("button", { name: "Salvar alteracoes" });
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await save.click();
      await expect(
        page.getByText("Produto atualizado com sucesso."),
      ).toBeVisible();
      await page.reload();
      await expect(page.getByLabel("Descrição")).toHaveValue(
        updatedDescription,
      );
      await expect(
        page.getByRole("status", { name: "Estoque atual" }),
      ).toHaveText("Estoque atual: 12 unidades");
      await expect(
        page.getByRole("radio", { name: /Adicionar/ }),
      ).toBeVisible();
      await expect(page.getByRole("radio", { name: /Remover/ })).toBeVisible();
      const persisted = await client
        .from("products")
        .select("description")
        .eq("id", product!.id)
        .single();
      expect(persisted.error).toBeNull();
      expect(persisted.data?.description).toBe(updatedDescription || null);
    }
  });
}

test("product without description remains accessible with read-only stock for operators", async ({
  page,
  browser,
}) => {
  await authenticatePage(page);
  const name = "Sem descricao " + crypto.randomUUID();
  await page.goto("/products/new");
  await page.getByLabel("Nome do produto").fill(name);
  await page.locator("#priceInReais").fill("35,00");
  await page.getByLabel("Quantidade inicial em estoque").fill("4");
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByText("Produto cadastrado com sucesso.")).toBeVisible();
  const client = await createAuthenticatedSupabaseClient();
  const product = await client
    .from("products")
    .select("id,description")
    .eq("name", name)
    .single();
  expect(product.error).toBeNull();
  expect(product.data?.description).toBeNull();
  const operator = await createAuthenticatedPage(browser, "operatorA");
  try {
    await operator.page.goto("/stock");
    await operator.page.locator("#stock-balance-search").fill(name);
    await operator.page.getByRole("link").filter({ hasText: name }).click();
    await expect(operator.page).toHaveURL(
      "/products/" + product.data!.id + "/edit",
    );
    await expect(operator.page.locator("#description")).toHaveValue("");
    await expect(
      operator.page.getByRole("status", { name: "Estoque atual" }),
    ).toHaveText("Estoque atual: 4 unidades");
    await expect(operator.page.getByRole("radio")).toHaveCount(0);
    await expect(
      operator.page.getByLabel("Quantidade", { exact: true }),
    ).toHaveCount(0);
    const operatorClient = await createAuthenticatedSupabaseClient("operatorA");
    const rejected = await operatorClient.from("stock_movements").insert({
      product_id: product.data!.id,
      type: "manual_adjustment",
      quantity_change: 1,
    });
    expect(rejected.error?.code).toBe("42501");
  } finally {
    await operator.context.close();
  }
});
