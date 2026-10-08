import { describe, expect, test } from "vitest";

import localConfig from "./playwright.config";

describe("Playwright suite isolation", () => {
  test("keeps the remote staging smoke out of the local E2E gate", () => {
    expect(localConfig.testIgnore).toBe("remote-staging-smoke.spec.ts");
  });
});
