import { defineConfig, devices } from "@playwright/test";

import manifestFixture from "./config/remote-environments.json";
import { parseRemoteEnvironmentManifest } from "./scripts/remote-environment-policy.mjs";
import { resolveRemoteProductionPlaywrightEnvironment } from "./scripts/remote-production-smoke-environment.mjs";

const smokeEnvironment = resolveRemoteProductionPlaywrightEnvironment(
  process.env,
  parseRemoteEnvironmentManifest(manifestFixture),
);

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  projects: [
    {
      name: "remote-production-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  testDir: "./tests/e2e",
  testMatch: "remote-production-smoke.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: smokeEnvironment.baseUrl,
    trace: "off",
  },
  workers: 1,
});
