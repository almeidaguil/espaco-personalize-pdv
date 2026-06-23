import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { authenticatePage, hasAuthenticatedE2EConfig } from "./support/auth";

const readOnlyRoutes = [
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
  "E2E auth and Supabase public env vars are required for read-only visual smoke tests.",
);

for (const route of readOnlyRoutes) {
  test(`read-only visual smoke ${route.path}`, async ({ page }, testInfo) => {
    const browserErrors = collectBrowserErrors(page);

    await authenticatePage(page);
    const response = await page.goto(route.path, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: route.heading }).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(browserErrors()).toEqual([]);

    await attachScreenshot(page, testInfo, route.path);
  });
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" && !isIgnoredConsoleError(message.text())) {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  return () => errors;
}

function isIgnoredConsoleError(message: string): boolean {
  return message.includes(
    "Failed to load resource: the server responded with a status of 404",
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  routePath: string,
) {
  const screenshot = await page.screenshot({ fullPage: true });

  await testInfo.attach(`read-only-${slugify(routePath)}.png`, {
    body: screenshot,
    contentType: "image/png",
  });
}

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "home";
}
