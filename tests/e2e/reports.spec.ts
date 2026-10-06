import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { authenticatePage, hasAuthenticatedE2EConfig } from "./support/auth";

const canSeedReport =
  hasAuthenticatedE2EConfig() && Boolean(process.env.SUPABASE_SECRET_KEY);
const cashSessionId = randomUUID();
const completedSaleId = randomUUID();
const canceledSaleId = randomUUID();
const productName = `Produto relatório E2E ${randomUUID().slice(0, 8)}`;
let productId: string | undefined;
let serviceClient: SupabaseClient | undefined;
let businessDate = "";

test.describe("relatório por período, vendedor e caixa", () => {
  test.skip(
    !canSeedReport,
    "E2E auth, public env and a Supabase secret key are required.",
  );

  test.beforeAll(async () => {
    serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SECRET_KEY ?? "",
      { auth: { persistSession: false } },
    );

    const userId = await findE2EUserId(serviceClient);
    const now = new Date();
    const openedAt = new Date(now.getTime() - 60 * 60 * 1_000);
    const completedAt = new Date(now.getTime() - 30 * 60 * 1_000);
    const canceledCompletedAt = new Date(now.getTime() - 20 * 60 * 1_000);
    const canceledAt = new Date(now.getTime() - 10 * 60 * 1_000);
    businessDate = formatBusinessDate(openedAt);

    const { data: product, error: productError } = await serviceClient
      .from("products")
      .insert({
        is_active: true,
        name: productName,
        price_in_cents: 2_500,
        sku: `REPORT-E2E-${randomUUID().slice(0, 12)}`,
      })
      .select("id")
      .single();
    expect(productError).toBeNull();
    if (!product) throw new Error("Could not seed the E2E report product.");
    productId = product.id;

    const { error: cashSessionError } = await serviceClient
      .from("cash_sessions")
      .insert({
        closed_at: now.toISOString(),
        closed_by: userId,
        counted_amount_in_cents: 3_400,
        difference_amount_in_cents: -100,
        expected_amount_in_cents: 3_500,
        id: cashSessionId,
        opened_at: openedAt.toISOString(),
        opening_amount_in_cents: 1_000,
        operator_id: userId,
        status: "closed",
      });
    expect(cashSessionError).toBeNull();

    const { error: salesError } = await serviceClient.from("sales").insert([
      {
        cash_session_id: cashSessionId,
        completed_at: completedAt.toISOString(),
        id: completedSaleId,
        operator_id: userId,
        status: "completed",
        total_in_cents: 2_500,
      },
      {
        canceled_at: canceledAt.toISOString(),
        cash_session_id: cashSessionId,
        completed_at: canceledCompletedAt.toISOString(),
        id: canceledSaleId,
        operator_id: userId,
        status: "canceled",
        total_in_cents: 1_000,
      },
    ]);
    expect(salesError).toBeNull();

    const { error: paymentsError } = await serviceClient
      .from("payments")
      .insert([
        {
          amount_in_cents: 3_000,
          change_in_cents: 500,
          method: "cash",
          sale_id: completedSaleId,
        },
        {
          amount_in_cents: 1_000,
          change_in_cents: 0,
          method: "pix",
          sale_id: canceledSaleId,
        },
      ]);
    expect(paymentsError).toBeNull();

    const { error: itemsError } = await serviceClient
      .from("sale_items")
      .insert([
        {
          product_id: productId,
          product_name: productName,
          quantity: 1,
          sale_id: completedSaleId,
          total_in_cents: 2_500,
          unit_price_in_cents: 2_500,
        },
        {
          product_id: productId,
          product_name: productName,
          quantity: 1,
          sale_id: canceledSaleId,
          total_in_cents: 1_000,
          unit_price_in_cents: 1_000,
        },
      ]);
    expect(itemsError).toBeNull();
  });

  test.afterAll(async () => {
    if (!serviceClient) return;

    const { error: salesError } = await serviceClient
      .from("sales")
      .delete()
      .in("id", [completedSaleId, canceledSaleId]);
    expect(salesError, "report sales cleanup").toBeNull();
    const { error: cashSessionError } = await serviceClient
      .from("cash_sessions")
      .delete()
      .eq("id", cashSessionId);
    expect(cashSessionError, "report cash session cleanup").toBeNull();
    if (productId) {
      const { error: productError } = await serviceClient
        .from("products")
        .delete()
        .eq("id", productId);
      expect(productError, "report product cleanup").toBeNull();
    }
  });

  test("mantém os totais da tela e do CSV consistentes", async ({ page }) => {
    await authenticatePage(page);
    await page.goto(
      `/reports?startDate=${businessDate}&endDate=${businessDate}&cashSessionId=${cashSessionId}`,
    );

    await expect(
      page.getByRole("heading", { level: 1, name: "Relatórios" }),
    ).toBeVisible();
    await expect(page.getByText("R$ 25,00").first()).toBeVisible();
    await expect(page.getByText("1 (R$ 10,00)")).toBeVisible();
    await expect(page.getByText(productName)).toBeVisible();
    await expect(page.getByText("R$ 1,00", { exact: true })).toBeVisible();

    const exportLink = page.getByRole("link", { name: "Exportar CSV" });
    const href = await exportLink.getAttribute("href");
    expect(href).toContain(`startDate=${businessDate}`);
    expect(href).toContain(`endDate=${businessDate}`);
    expect(href).toContain(`cashSessionId=${cashSessionId}`);

    const response = await page.request.get(href ?? "");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    const csv = await response.text();
    expect(csv).toContain("Resumo;vendas_concluidas;Vendas concluídas;1;25,00");
    expect(csv).toContain(
      "Resumo;vendas_canceladas;Vendas canceladas (fora da receita);1;10,00",
    );
    expect(csv).toContain(`Produto;${productId};${productName};1;25,00`);
    expect(csv).toContain(
      `Divergência de caixa;${cashSessionId};E2E Admin;;-1,00`,
    );
  });
});

async function findE2EUserId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1_000,
  });
  expect(error).toBeNull();
  const user = data.users.find(
    (candidate) => candidate.email === process.env.E2E_USER_EMAIL,
  );
  expect(user).toBeDefined();
  return user?.id ?? "";
}

function formatBusinessDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).format(date);
}
