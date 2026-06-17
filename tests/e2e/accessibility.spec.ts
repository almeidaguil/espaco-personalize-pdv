import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { authenticatePage, hasAuthenticatedE2EConfig } from "./support/auth";

const authenticatedRoutes = [
  "/",
  "/products",
  "/events",
  "/pdv",
  "/cash/open",
  "/cash/close",
  "/sales",
  "/settings",
];

test("login page has no critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Acessar PDV" }),
  ).toBeVisible();

  await expectNoAccessibilityViolations(page);
});

test.skip(
  !hasAuthenticatedE2EConfig(),
  "E2E auth and Supabase public env vars are required for authenticated accessibility tests.",
);

for (const route of authenticatedRoutes) {
  test(`authenticated route ${route} has no critical accessibility violations`, async ({
    page,
  }) => {
    await authenticatePage(page);
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();

    await expectNoAccessibilityViolations(page);
  });
}

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(results.violations).toEqual([]);
}
