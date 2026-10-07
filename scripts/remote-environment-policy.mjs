import { readFile } from "node:fs/promises";

import { z } from "zod";

const projectRefSchema = z.string().regex(/^[a-z]{20}$/);
const nullableProjectRefSchema = projectRefSchema.nullable();
const uuidSchema = z.string().uuid();
const nullableUuidSchema = uuidSchema.nullable();

const supabaseProjectSchema = z.object({
  hostname: z.string().regex(/^[a-z]{20}\.supabase\.co$/),
  name: z.string().min(1),
  projectRef: projectRefSchema,
  region: z.string().min(1),
});

const supabaseTargetSchema = z.object({
  hostname: z
    .string()
    .regex(/^[a-z]{20}\.supabase\.co$/)
    .nullable(),
  name: z.string().min(1),
  projectRef: nullableProjectRefSchema,
  region: z.literal("sa-east-1"),
});

const remoteEnvironmentManifestSchema = z.object({
  netlify: z.object({
    accountId: nullableUuidSchema,
    productionBranch: z.string().min(1),
    repository: z.string().regex(/^[^/]+\/[^/]+$/),
    siteId: nullableUuidSchema,
    siteName: z.string().regex(/^[a-z0-9-]+$/),
    siteUrl: z.url().refine((value) => value.startsWith("https://")),
    stagingBranch: z.string().min(1),
  }),
  supabase: z.object({
    legacy: z.object({
      production: supabaseProjectSchema,
      staging: supabaseProjectSchema,
    }),
    organization: z.object({
      id: z.string().regex(/^[a-z]{20}$/),
      name: z.string().min(1),
    }),
    targets: z.object({
      production: supabaseTargetSchema,
      staging: supabaseTargetSchema,
    }),
  }),
  version: z.literal(1),
});

export async function loadRemoteEnvironmentManifest(filePath) {
  const contents = await readFile(filePath, "utf8");
  return parseRemoteEnvironmentManifest(JSON.parse(contents));
}

export function parseRemoteEnvironmentManifest(value) {
  const result = remoteEnvironmentManifestSchema.safeParse(value);

  if (!result.success) {
    throw new Error("Invalid remote environment manifest.");
  }

  return result.data;
}

export function validateRemoteOperation({
  confirmation = /** @type {string | undefined} */ (undefined),
  environment,
  execute,
  manifest,
  operation,
  provider,
  target,
}) {
  const parsedManifest = parseRemoteEnvironmentManifest(manifest);

  if (!["read", "mutate"].includes(operation)) {
    throw new Error("Unsupported remote operation.");
  }

  const validatedTarget =
    provider === "supabase"
      ? validateSupabaseTarget(parsedManifest, environment, target)
      : provider === "netlify"
        ? validateNetlifyTarget(parsedManifest, environment, target)
        : null;

  if (!validatedTarget) {
    throw new Error("Unsupported remote provider or environment.");
  }

  if (operation === "mutate") {
    if (execute !== true) {
      throw new Error("Remote mutation requires --execute.");
    }

    if (confirmation !== validatedTarget.identifier) {
      throw new Error("Remote mutation requires confirmação literal do alvo.");
    }
  }

  return {
    environment,
    hostname: validatedTarget.hostname,
    identifier: validatedTarget.identifier,
    name: validatedTarget.name,
    operation,
    provider,
    result: "authorized",
  };
}

function validateSupabaseTarget(manifest, environment, target) {
  const expected = resolveSupabaseEnvironment(manifest, environment);

  if (!expected) {
    return null;
  }

  if (environment === "staging") {
    if (target.projectRef === manifest.supabase.legacy.production.projectRef) {
      throw new Error("Ref de produção não pode ser usado como staging.");
    }

    if (target.projectRef === manifest.supabase.legacy.staging.projectRef) {
      throw new Error("Ref legado não pode ser usado como novo staging.");
    }
  }

  const expectedValues = {
    hostname: expected.hostname,
    name: expected.name,
    organizationId: manifest.supabase.organization.id,
    projectRef: expected.projectRef,
  };

  assertExactTarget(expectedValues, target);

  return {
    hostname: target.hostname ?? null,
    identifier: expected.projectRef ?? expected.name,
    name: expected.name,
  };
}

function resolveSupabaseEnvironment(manifest, environment) {
  if (environment === "legacy-staging") {
    return manifest.supabase.legacy.staging;
  }

  if (environment === "legacy-production") {
    return manifest.supabase.legacy.production;
  }

  if (environment === "staging") {
    return manifest.supabase.targets.staging;
  }

  if (environment === "production") {
    return manifest.supabase.targets.production;
  }

  return null;
}

function validateNetlifyTarget(manifest, environment, target) {
  if (environment !== "staging" && environment !== "production") {
    return null;
  }

  const expectedHostname = new URL(manifest.netlify.siteUrl).hostname;
  const expectedValues = {
    accountId: manifest.netlify.accountId,
    hostname: expectedHostname,
    siteId: manifest.netlify.siteId,
    siteName: manifest.netlify.siteName,
  };

  assertExactTarget(expectedValues, target);

  return {
    hostname: expectedHostname,
    identifier: manifest.netlify.siteId ?? manifest.netlify.siteName,
    name: manifest.netlify.siteName,
  };
}

function assertExactTarget(expected, actual) {
  const divergent = Object.entries(expected).find(
    ([key, value]) => (actual[key] ?? null) !== (value ?? null),
  );

  if (divergent) {
    throw new Error(`Alvo remoto divergente no campo ${divergent[0]}.`);
  }
}

export function redactSensitiveText(value, sensitiveValues) {
  const secrets = sensitiveValues
    .filter((secret) => typeof secret === "string" && secret.length > 0)
    .sort((left, right) => right.length - left.length);

  return redactValue(value, secrets, new WeakSet());
}

function redactValue(value, secrets, seen) {
  if (typeof value === "string") {
    return secrets.reduce(
      (redacted, secret) => redacted.replaceAll(secret, "[REDACTED]"),
      value,
    );
  }

  if (value instanceof Error) {
    return {
      message: redactValue(value.message, secrets, seen),
      name: value.name,
      stack: redactValue(value.stack ?? "", secrets, seen),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, secrets, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);
    const redacted = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactValue(item, secrets, seen),
      ]),
    );
    seen.delete(value);
    return redacted;
  }

  return value;
}

export function createSafeLogger({ log, sensitiveValues }) {
  return (...values) =>
    log(...values.map((value) => redactSensitiveText(value, sensitiveValues)));
}
