import { existsSync, readFileSync } from "node:fs";

loadEnvFile(".env.local");
loadEnvFile(".env.e2e.local");

const requiredVariables = [
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
];

const missingVariables = requiredVariables.filter(
  (variableName) => !process.env[variableName],
);

if (missingVariables.length > 0) {
  console.error("Missing required E2E environment variables:");
  missingVariables.forEach((variableName) => {
    console.error(`- ${variableName}`);
  });
  console.error(
    "Set these variables before running npm run test:e2e:required.",
  );
  process.exit(1);
}

const expectedProjectRef = process.env.E2E_EXPECTED_SUPABASE_PROJECT_REF;

if (expectedProjectRef) {
  assertExpectedSupabaseProject(expectedProjectRef);
}

console.log("E2E environment variables are present.");

function assertExpectedSupabaseProject(expectedProjectRef) {
  if (!/^[a-z0-9]{20}$/.test(expectedProjectRef)) {
    console.error("Invalid expected Supabase project ref for the E2E gate.");
    process.exit(1);
  }

  let supabaseUrl;

  try {
    supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    console.error("Invalid NEXT_PUBLIC_SUPABASE_URL for the E2E gate.");
    process.exit(1);
  }

  if (supabaseUrl.hostname !== `${expectedProjectRef}.supabase.co`) {
    console.error(
      "Refusing to run E2E against a Supabase project other than staging.",
    );
    process.exit(1);
  }
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
