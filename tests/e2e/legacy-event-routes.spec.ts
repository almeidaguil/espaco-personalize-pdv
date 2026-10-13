import { expect, test } from "@playwright/test";

import { authenticatePage, hasAuthenticatedE2EConfig } from "./support/auth";

const legacyRoutes = [
  { path: "/events", loginPath: "/login?next=%2Fevents" },
  { path: "/events/new", loginPath: "/login?next=%2Fevents%2Fnew" },
] as const;

for (const route of legacyRoutes) {
  test(`anonymous access to ${route.path} preserves the login return path`, async ({
    page,
  }) => {
    await page.goto(route.path);

    await expect(page).toHaveURL(
      `${process.env.E2E_BASE_URL?.trim() || "http://localhost:3000"}${route.loginPath}`,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Acessar Sistema" }),
    ).toBeVisible();
  });

  test(`authenticated access to ${route.path} returns a controlled 404`, async ({
    page,
  }) => {
    test.skip(
      !hasAuthenticatedE2EConfig(),
      "Credenciais E2E e configuração pública do Supabase são necessárias para validar o 404 autenticado.",
    );

    await authenticatePage(page);
    const response = await page.goto(route.path);

    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(
      `${process.env.E2E_BASE_URL?.trim() || "http://localhost:3000"}${route.path}`,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Página não encontrada" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Voltar ao painel" }),
    ).toHaveAttribute("href", "/");
  });
}
