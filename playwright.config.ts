import { existsSync, readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

loadEnvFile(".env.local");
loadEnvFile(".env.e2e.local");

const configuredE2EBaseUrl = process.env.E2E_BASE_URL?.trim();
const e2eBaseUrl = configuredE2EBaseUrl || "http://localhost:3000";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  globalSetup: "./tests/e2e/global-setup.ts",
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: e2eBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: configuredE2EBaseUrl
    ? undefined
    : {
        command: "npm run dev -- --hostname localhost --port 3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: "http://localhost:3000",
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const separatorIndex = line.indexOf("=");

      if (separatorIndex === -1) {
        return;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());

      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
}

function stripWrappingQuotes(value: string) {
  const firstCharacter = value.at(0);
  const lastCharacter = value.at(-1);

  if (
    value.length >= 2 &&
    ((firstCharacter === '"' && lastCharacter === '"') ||
      (firstCharacter === "'" && lastCharacter === "'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
