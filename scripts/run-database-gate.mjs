import { spawnSync } from "node:child_process";

if (process.argv.length > 2) {
  throw new Error(
    "The database gate accepts no arguments, including --linked.",
  );
}
if (process.env.DATABASE_TEST_SUPABASE_URL) {
  assertLocalUrl(process.env.DATABASE_TEST_SUPABASE_URL);
}

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const statusResult = spawnSync(
  npxCommand,
  ["supabase", "status", "-o", "env"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_TELEMETRY_DISABLED: "1",
    },
    shell: process.platform === "win32",
  },
);

if (statusResult.status !== 0) {
  console.error("The local Supabase stack is not available.");
  process.exit(statusResult.status ?? 1);
}

const localEnvironment = parseSupabaseEnvironment(statusResult.stdout);
const requiredVariables = ["API_URL", "PUBLISHABLE_KEY", "SECRET_KEY"];
const missingVariables = requiredVariables.filter(
  (variableName) => !localEnvironment[variableName],
);

if (missingVariables.length > 0) {
  console.error(
    `Missing local Supabase values: ${missingVariables.join(", ")}.`,
  );
  process.exit(1);
}

const apiUrl = new URL(localEnvironment.API_URL);

assertLocalUrl(apiUrl.toString());
if (localEnvironment.DB_URL) assertLocalUrl(localEnvironment.DB_URL);
console.log(`Database gate local hostname: ${apiUrl.hostname}`);

const testEnvironment = {
  ...process.env,
  DATABASE_TEST_SUPABASE_PUBLISHABLE_KEY: localEnvironment.PUBLISHABLE_KEY,
  DATABASE_TEST_SUPABASE_SECRET_KEY: localEnvironment.SECRET_KEY,
  DATABASE_TEST_SUPABASE_URL: apiUrl.toString(),
  SUPABASE_TELEMETRY_DISABLED: "1",
};

console.log("Database gate: upgrade from PR05.");
resetLocalDatabase(["--version", "20261003120000"]);
runRequiredCommand(process.execPath, [
  "scripts/test-remove-events-upgrade.mjs",
  "seed",
]);
runRequiredCommand(npxCommand, ["supabase", "migration", "up", "--local"]);
runDatabaseTests(true);

console.log("Database gate: fresh reset.");
resetLocalDatabase([]);
runDatabaseTests(false);

console.log("Database gate completed successfully.");

function runRequiredCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: testEnvironment,
    shell: process.platform === "win32" && command === npxCommand,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resetLocalDatabase(versionArgs) {
  assertLocalUrl(testEnvironment.DATABASE_TEST_SUPABASE_URL);
  if (localEnvironment.DB_URL) assertLocalUrl(localEnvironment.DB_URL);
  runRequiredCommand(npxCommand, [
    "supabase",
    "db",
    "reset",
    "--local",
    "--yes",
    ...versionArgs,
  ]);
}

function runDatabaseTests(verifyUpgrade) {
  runRequiredCommand(npxCommand, [
    "supabase",
    "test",
    "db",
    "supabase/tests/database",
    "--local",
  ]);
  if (verifyUpgrade) {
    runRequiredCommand(process.execPath, [
      "scripts/test-remove-events-upgrade.mjs",
      "verify",
    ]);
  }
  runRequiredCommand(process.execPath, ["scripts/test-store-database.mjs"]);
  runRequiredCommand(process.execPath, [
    "scripts/test-sales-report-database.mjs",
  ]);
}

function assertLocalUrl(value) {
  if (!isLocalHostname(new URL(value).hostname)) {
    throw new Error(
      "Refusing to run the database gate against a remote Supabase.",
    );
  }
}

function parseSupabaseEnvironment(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[A-Z0-9_]+=.*/.test(line))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex);
        const rawValue = line.slice(separatorIndex + 1);

        return [key, stripWrappingQuotes(rawValue)];
      }),
  );
}

function stripWrappingQuotes(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
}

function isLocalHostname(hostname) {
  return ["127.0.0.1", "::1", "[::1]", "localhost"].includes(hostname);
}
