import { defineConfig, devices } from "@playwright/test";

import manifestFixture from "./config/remote-environments.json";
import { parseRemoteEnvironmentManifest } from "./scripts/remote-environment-policy.mjs";
import {
  createRemoteStagingPlaywrightUse,
  resolveRemoteStagingSmokeEnvironment,
} from "./scripts/remote-staging-smoke-environment.mjs";

const smokeEnvironment = resolveRemoteStagingSmokeEnvironment(
  process.env,
  parseRemoteEnvironmentManifest(manifestFixture),
);

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  projects: [
    {
      name: "remote-staging-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  testDir: "./tests/e2e",
  testMatch: "remote-staging-smoke.spec.ts",
  timeout: 60_000,
  use: {
    ...createRemoteStagingPlaywrightUse(smokeEnvironment),
    trace: "off",
  },
  workers: 1,
});
