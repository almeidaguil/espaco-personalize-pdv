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
runRequiredCommand(process.execPath, [
  "scripts/test-product-sku-upgrade.mjs",
  "seed-normalization",
]);
runRequiredCommand(npxCommand, ["supabase", "migration", "up", "--local"]);
runRequiredCommand(process.execPath, [
  "scripts/test-product-sku-upgrade.mjs",
  "verify-normalization",
]);
runDatabaseTests(true);

console.log("Database gate: product SKU collision guard.");
resetLocalDatabase(["--version", "20261005143000"]);
runRequiredCommand(process.execPath, [
  "scripts/test-product-sku-upgrade.mjs",
  "seed-collision",
]);
runExpectedFailure(
  npxCommand,
  ["supabase", "migration", "up", "--local"],
  "Product SKU normalization collision",
);

console.log("Database gate: sale discount upgrade and legacy V3 retry.");
resetLocalDatabase(["--version", "20261013190000"]);
runRequiredCommand(process.execPath, [
  "scripts/test-sale-discount-upgrade.mjs",
  "seed-valid",
]);
runRequiredCommand(npxCommand, ["supabase", "migration", "up", "--local"]);
runRequiredCommand(process.execPath, [
  "scripts/test-sale-discount-upgrade.mjs",
  "verify-valid",
]);

console.log("Database gate: sale discount incompatible-history guard.");
resetLocalDatabase(["--version", "20261013190000"]);
runRequiredCommand(process.execPath, [
  "scripts/test-sale-discount-upgrade.mjs",
  "seed-invalid",
]);
runExpectedFailure(
  npxCommand,
  ["supabase", "migration", "up", "--local"],
  "Sale discount migration requires every existing sale total to be positive",
);

console.log("Database gate: split payment schema upgrade.");
resetLocalDatabase(["--version", "20261014120000"]);
runRequiredCommand(process.execPath, [
  "scripts/test-split-payments-upgrade.mjs",
  "seed-valid",
]);
runRequiredCommand(npxCommand, ["supabase", "migration", "up", "--local"]);
runRequiredCommand(process.execPath, [
  "scripts/test-split-payments-upgrade.mjs",
  "verify-valid",
]);

console.log("Database gate: duplicate payment method guard.");
resetLocalDatabase(["--version", "20261014120000"]);
runRequiredCommand(process.execPath, [
  "scripts/test-split-payments-upgrade.mjs",
  "seed-duplicate",
]);
runExpectedFailure(
  npxCommand,
  ["supabase", "migration", "up", "--local"],
  "Split payment migration found duplicate payment methods for a sale",
);

console.log("Database gate: invalid net payment guard.");
resetLocalDatabase(["--version", "20261014120000"]);
runRequiredCommand(process.execPath, [
  "scripts/test-split-payments-upgrade.mjs",
  "seed-invalid-payment",
]);
runExpectedFailure(
  npxCommand,
  ["supabase", "migration", "up", "--local"],
  "Split payment migration requires positive net payment amounts",
);

console.log("Database gate: missing historical payment guard.");
resetLocalDatabase(["--version", "20261014120000"]);
runRequiredCommand(process.execPath, [
  "scripts/test-split-payments-upgrade.mjs",
  "seed-missing-payment",
]);
runExpectedFailure(
  npxCommand,
  ["supabase", "migration", "up", "--local"],
  "Split payment migration found a sale without payments",
);

console.log("Database gate: historical payment method limit guard.");
resetLocalDatabase(["--version", "20261014120000"]);
runRequiredCommand(process.execPath, [
  "scripts/test-split-payments-upgrade.mjs",
  "seed-too-many-methods",
]);
runExpectedFailure(
  npxCommand,
  ["supabase", "migration", "up", "--local"],
  "Split payment migration found a sale with more than two payment methods",
);

console.log("Database gate: historical payment total guard.");
resetLocalDatabase(["--version", "20261014120000"]);
runRequiredCommand(process.execPath, [
  "scripts/test-split-payments-upgrade.mjs",
  "seed-mismatched-total",
]);
runExpectedFailure(
  npxCommand,
  ["supabase", "migration", "up", "--local"],
  "Split payment migration found a sale whose payments do not match its total",
);

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

function runExpectedFailure(command, args, expectedMessage) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: testEnvironment,
    shell: process.platform === "win32" && command === npxCommand,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  if (result.status === 0 || !output.includes(expectedMessage)) {
    console.error("Expected migration failure was not observed.");
    process.exit(1);
  }

  console.log(`Expected local migration failure verified: ${expectedMessage}`);
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
    "scripts/test-sale-discount-database.mjs",
  ]);
  runRequiredCommand(process.execPath, [
    "scripts/test-split-payments-database.mjs",
  ]);
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
