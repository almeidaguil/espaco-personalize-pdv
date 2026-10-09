import { createHash } from "node:crypto";

const requiredKeys = Object.freeze([
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
]);

export function createProductionEnvironmentFingerprint(values) {
  const keys = Object.keys(values ?? {}).sort();
  const expectedKeys = [...requiredKeys].sort();
  if (
    JSON.stringify(keys) !== JSON.stringify(expectedKeys) ||
    expectedKeys.some((key) => typeof values[key] !== "string" || !values[key])
  ) {
    throw new Error("Production environment fingerprint input is incomplete.");
  }
  const canonical = expectedKeys
    .map((key) => `${key}=${values[key]}`)
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}
