import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createTestProductWithStock(
  adminPage: Page,
  quantity: number,
) {
  const identifier = randomUUID();
  const productName = `Produto E2E ${identifier}`;
  await adminPage.goto("/products/new");
  await adminPage.getByLabel("Nome do produto").fill(productName);
  await adminPage.locator("#priceInReais").fill("15,00");
  await adminPage.getByLabel("SKU").fill(`E2E-${identifier}`);
  await adminPage.getByRole("button", { name: "Salvar produto" }).click();
  await expect(
    adminPage.getByText("Produto cadastrado com sucesso."),
  ).toBeVisible();
  await adminPage.goto("/stock");
  const productId = await adminPage
    .locator("select#productId option", { hasText: productName })
    .getAttribute("value");
  if (!productId)
    throw new Error(
      "The newly created E2E product must be available for stock adjustment.",
    );
  await adminPage
    .getByLabel("Produto", { exact: true })
    .selectOption(productId);
  await adminPage.getByLabel("Quantidade").fill(String(quantity));
  await adminPage.getByRole("button", { name: "Registrar ajuste" }).click();
  await expect(
    adminPage.getByText("Estoque ajustado com sucesso."),
  ).toBeVisible();
  return { productId, productName };
}

// Return the thenable without awaiting: callers start both real HTTP transactions at the Promise.all barrier.
export function finalizeSale(
  client: SupabaseClient,
  cashSessionId: string,
  productId: string,
  saleId: string,
) {
  return client.rpc("finalize_sale_v3", {
    p_sale_id: saleId,
    p_cash_session_id: cashSessionId,
    p_items: [{ product_id: productId, quantity: 1 }],
    p_payment: { method: "cash", amount_in_cents: 1500, change_in_cents: 0 },
  });
}
