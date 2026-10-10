import { readFile } from "node:fs/promises";

import { z } from "zod";

const projectRefSchema = z.string().regex(/^[a-z]{20}$/);
const nullableProjectRefSchema = projectRefSchema.nullable();
const vercelOrgIdSchema = z.string().regex(/^team_[A-Za-z0-9]+$/);
const vercelProjectIdSchema = z.string().regex(/^prj_[A-Za-z0-9]+$/);
const sourceRefSchema = z
  .string()
  .regex(/^(?:feature\/[a-z0-9-]+|develop|main)$/);

const supabaseProjectSchema = z
  .object({
    hostname: z.string().regex(/^[a-z]{20}\.supabase\.co$/),
    name: z.string().min(1),
    projectRef: projectRefSchema,
    region: z.string().min(1),
  })
  .strict();

const supabaseTargetSchema = z
  .object({
    hostname: z
      .string()
      .regex(/^[a-z]{20}\.supabase\.co$/)
      .nullable(),
    name: z.string().min(1),
    projectRef: nullableProjectRefSchema,
    region: z.literal("sa-east-1"),
  })
  .strict();

const vercelTargetBaseSchema = z
  .object({
    allowedSourceRefs: z.array(sourceRefSchema).min(1),
    deploymentId: z
      .string()
      .regex(/^dpl_[A-Za-z0-9]+$/)
      .nullable(),
    deploymentUrl: z
      .url()
      .refine((value) => value.startsWith("https://"))
      .nullable(),
    environment: z.literal("production"),
    projectId: vercelProjectIdSchema,
    projectName: z.string().regex(/^[a-z0-9-]+$/),
    releaseBranch: z.enum(["develop", "main"]),
    siteUrl: z.url().refine((value) => value.startsWith("https://")),
    sourceRef: sourceRefSchema,
  })
  .strict()
  .superRefine((target, context) => {
    if (!target.allowedSourceRefs.includes(target.sourceRef)) {
      context.addIssue({
        code: "custom",
        message: "sourceRef must be explicitly allowed",
        path: ["sourceRef"],
      });
    }
  });

const vercelStagingTargetSchema = vercelTargetBaseSchema.safeExtend({
  dedicatedStaging: z.literal(true),
  deploymentProtection: z.literal("vercel-authentication"),
  projectName: z.string().regex(/^[a-z0-9-]+-staging$/),
  releaseBranch: z.literal("develop"),
  siteUrl: z.literal("https://roberto-multimarcas-pdv-staging.vercel.app"),
});

const vercelProductionTargetSchema = vercelTargetBaseSchema.safeExtend({
  dedicatedStaging: z.literal(false),
  deploymentProtection: z.literal("application-auth"),
  projectName: z.literal("roberto-multimarcas-pdv"),
  releaseBranch: z.literal("main"),
  siteUrl: z.literal("https://roberto-multimarcas-pdv.vercel.app"),
});

const remoteEnvironmentManifestSchema = z
  .object({
    vercel: z
      .object({
        framework: z.literal("nextjs"),
        gitConnectionAllowed: z.literal(false),
        nodeVersion: z.literal("22.x"),
        orgId: vercelOrgIdSchema,
        repository: z.string().regex(/^[^/]+\/[^/]+$/),
        repositoryId: z.number().int().positive(),
        scope: z.string().regex(/^[a-z0-9-]+$/),
        targets: z
          .object({
            production: vercelProductionTargetSchema,
            staging: vercelStagingTargetSchema,
          })
          .strict(),
      })
      .strict(),
    supabase: z
      .object({
        legacy: z
          .object({
            production: supabaseProjectSchema,
            staging: supabaseProjectSchema,
          })
          .strict(),
        organization: z
          .object({
            id: z.string().regex(/^[a-z]{20}$/),
            name: z.string().min(1),
          })
          .strict(),
        targets: z
          .object({
            production: supabaseTargetSchema,
            staging: supabaseTargetSchema,
          })
          .strict(),
      })
      .strict(),
    version: z.literal(2),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (
      manifest.vercel.targets.production.projectId ===
      manifest.vercel.targets.staging.projectId
    ) {
      context.addIssue({
        code: "custom",
        message: "Vercel targets must use different projects",
        path: ["vercel", "targets"],
      });
    }
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

export function resolveRemoteTarget(manifest, { environment, provider }) {
  const parsedManifest = parseRemoteEnvironmentManifest(manifest);

  if (provider === "supabase") {
    const target = resolveSupabaseEnvironment(parsedManifest, environment);
    if (!target) {
      throw new Error("Unsupported remote provider or environment.");
    }

    return Object.freeze({
      environment,
      hostname: target.hostname,
      identifier: target.projectRef ?? target.name,
      name: target.name,
      organizationId: parsedManifest.supabase.organization.id,
      projectRef: target.projectRef,
      provider,
      region: target.region,
    });
  }

  if (
    provider === "vercel" &&
    ["staging", "production"].includes(environment)
  ) {
    const common = {
      framework: parsedManifest.vercel.framework,
      gitConnectionAllowed: parsedManifest.vercel.gitConnectionAllowed,
      nodeVersion: parsedManifest.vercel.nodeVersion,
      orgId: parsedManifest.vercel.orgId,
      repository: parsedManifest.vercel.repository,
      repositoryId: parsedManifest.vercel.repositoryId,
      scope: parsedManifest.vercel.scope,
    };
    const target = parsedManifest.vercel.targets[environment];

    return Object.freeze({
      ...common,
      ...target,
      allowedSourceRefs: Object.freeze([...target.allowedSourceRefs]),
      deploymentEnvironment: target.environment,
      environment,
      identifier: target.projectId,
      logicalEnvironment: environment,
      provider,
    });
  }

  throw new Error("Unsupported remote provider or environment.");
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
  let expected;
  try {
    expected = resolveRemoteTarget(manifest, {
      environment,
      provider: "supabase",
    });
  } catch {
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
    organizationId: expected.organizationId,
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
  let expected;
  try {
    expected = resolveRemoteTarget(manifest, {
      environment,
      provider: "vercel",
    });
  } catch {
    return null;
  }

  const expectedValues = {
    orgId: expected.orgId,
    projectId: expected.projectId,
    projectName: expected.projectName,
  };

  assertExactTarget(expectedValues, target);

  return {
    hostname: expected.deploymentUrl
      ? new URL(expected.deploymentUrl).hostname
      : null,
    identifier: expected.projectId,
    name: expected.projectName,
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
