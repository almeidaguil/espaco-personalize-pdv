import { expect, test } from "@playwright/test";

const routes = [
  { heading: /Caixa aberto|Caixa fechado/, path: "/" },
  { heading: "Produtos", path: "/products" },
  { heading: "PDV", path: "/pdv" },
  { heading: "Abrir caixa", path: "/cash/open" },
  { heading: "Vendas", path: "/sales" },
  { heading: "Estoque", path: "/stock" },
  { heading: "Relatórios", path: "/reports" },
];

test("remote staging protects routes and supports an authenticated read-only traversal", async ({
  page,
}) => {
  await page.goto("/pdv");
  await expect(page).toHaveURL(/\/login\?next=%2Fpdv$/);

  await page
    .getByRole("textbox", { name: "E-mail" })
    .fill(process.env.STAGING_ADMIN_EMAIL!);
  await page.getByLabel("Senha").fill(process.env.STAGING_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  for (const route of routes) {
    const response = await page.goto(route.path, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { level: 1, name: route.heading }).first(),
    ).toBeVisible();
  }
});
