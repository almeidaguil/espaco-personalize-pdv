import { readFile } from "node:fs/promises";

import { z } from "zod";

const projectRefSchema = z.string().regex(/^[a-z]{20}$/);
const nullableProjectRefSchema = projectRefSchema.nullable();
const vercelOrgIdSchema = z.string().regex(/^team_[A-Za-z0-9]+$/);
const vercelProjectIdSchema = z.string().regex(/^prj_[A-Za-z0-9]+$/);

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
  vercel: z.object({
    deploymentId: z
      .string()
      .regex(/^dpl_[A-Za-z0-9]+$/)
      .nullable(),
    deploymentUrl: z
      .url()
      .refine((value) => value.startsWith("https://"))
      .nullable(),
    dedicatedStaging: z.literal(true),
    deploymentProtection: z.literal("vercel-authentication"),
    environment: z.literal("production"),
    framework: z.literal("nextjs"),
    gitConnectionAllowed: z.literal(false),
    nodeVersion: z.literal("22.x"),
    orgId: vercelOrgIdSchema,
    projectId: vercelProjectIdSchema,
    projectName: z.string().regex(/^[a-z0-9-]+$/),
    reservedProductionProjectId: vercelProjectIdSchema,
    reservedProductionProjectName: z.string().regex(/^[a-z0-9-]+$/),
    repository: z.string().regex(/^[^/]+\/[^/]+$/),
    repositoryId: z.number().int().positive(),
    siteUrl: z
      .url()
      .refine(
        (value) =>
          value === "https://roberto-multimarcas-pdv-staging.vercel.app",
      ),
    scope: z.string().regex(/^[a-z0-9-]+$/),
    sourceRef: z.string().regex(/^feature\/[a-z0-9-]+$/),
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
      : provider === "vercel"
        ? validateVercelTarget(parsedManifest, environment, target)
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

function validateVercelTarget(manifest, environment, target) {
  if (environment !== "staging") {
    return null;
  }

  const expectedValues = {
    orgId: manifest.vercel.orgId,
    projectId: manifest.vercel.projectId,
    projectName: manifest.vercel.projectName,
  };

  assertExactTarget(expectedValues, target);

  return {
    hostname: manifest.vercel.deploymentUrl
      ? new URL(manifest.vercel.deploymentUrl).hostname
      : null,
    identifier: manifest.vercel.projectId,
    name: manifest.vercel.projectName,
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
