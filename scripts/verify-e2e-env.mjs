import { existsSync, readFileSync } from "node:fs";

import { assertLocalSupabaseUrl, resolveE2EUsers } from "./e2e-test-users.mjs";

loadEnvFile(".env.local");
loadEnvFile(".env.e2e.local");

try {
  resolveE2EUsers(process.env);
  const requiredVariables = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
  ];

  const missingVariables = requiredVariables.filter(
    (variableName) => !process.env[variableName]?.trim(),
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required E2E environment variables: ${missingVariables.join(", ")}`,
    );
  }

  assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  console.log("Local E2E environment variables are present.");
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Invalid local E2E environment.",
  );
  process.exit(1);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(
      trimmedLine.slice(separatorIndex + 1).trim(),
    );

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function stripWrappingQuotes(value) {
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
