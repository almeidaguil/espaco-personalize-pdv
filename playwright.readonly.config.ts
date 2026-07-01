import { existsSync, readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

loadEnvFile(".env.local");
loadEnvFile(".env.e2e.local");

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  testDir: "./tests/e2e",
  testMatch: "read-only-visual-smoke.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --hostname localhost --port 3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: "http://localhost:3000",
      },
  workers: 1,
  projects: [
    {
      name: "readonly-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "readonly-mobile",
      use: { ...devices["Pixel 5"] },
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
