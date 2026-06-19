import { expect, test } from "@playwright/test";

import { authenticatePage, hasAuthenticatedE2EConfig } from "./support/auth";

const authenticatedRoutes = [
  { heading: "PDV", path: "/" },
  { heading: "Produtos", path: "/products" },
  { heading: "Novo produto", path: "/products/new" },
  { heading: "Eventos", path: "/events" },
  { heading: "Novo evento", path: "/events/new" },
  { heading: "Estoque", path: "/stock" },
  { heading: "PDV", path: "/pdv" },
  { heading: "Abrir caixa", path: "/cash/open" },
  { heading: "Fechar caixa", path: "/cash/close" },
  { heading: "Vendas", path: "/sales" },
  { heading: "Relatorios", path: "/reports" },
  { heading: "Configuracoes", path: "/settings" },
];

test.skip(
  !hasAuthenticatedE2EConfig(),
  "E2E auth and Supabase public env vars are required for authenticated route smoke tests.",
);

for (const route of authenticatedRoutes) {
  test(`authenticated route ${route.path} renders the expected screen`, async ({
    page,
  }) => {
    await authenticatePage(page);
    const response = await page.goto(route.path);

    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: route.heading }).first(),
    ).toBeVisible();
  });
}

test("legacy /sale route redirects to the sales screen", async ({ page }) => {
  await authenticatePage(page);
  await page.goto("/sale");

  await expect(page).toHaveURL(/\/sales$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Vendas" }),
  ).toBeVisible();
});

test("reports CSV endpoint responds with controlled validation", async ({
  request,
}) => {
  const response = await request.get("/reports/export");

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({
    error: "Nao foi possivel exportar o relatorio.",
  });
});
