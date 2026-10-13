import { describe, expect, test } from "vitest";

import localConfig from "./playwright.config";

describe("Playwright suite isolation", () => {
  test("keeps every remote smoke out of the local E2E gate", () => {
    expect(localConfig.testIgnore).toEqual([
      "remote-staging-smoke.spec.ts",
      "remote-production-smoke.spec.ts",
    ]);
  });
});
