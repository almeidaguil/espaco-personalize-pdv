import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { z } from "zod";

const authorizedRoot = resolve(".provisioning/production-backup");
const projectRefSchema = z.string().regex(/^[a-z]{20}$/);
const countSchema = z.number().int().nonnegative();
const countsSchema = z.record(z.string().min(1), countSchema);

const sourceSchema = z
  .object({
    databaseVersion: z.string().min(1),
    hostname: z.string().regex(/^[a-z]{20}\.supabase\.co$/),
    name: z.string().min(1),
    organizationId: projectRefSchema,
    projectRef: projectRefSchema,
    region: z.string().min(1),
    status: z.string().min(1),
  })
  .strict();

const authSchema = z
  .object({
    configuration: z
      .object({
        anonymousUsersEnabled: z.boolean(),
        disableSignup: z.boolean(),
        emailEnabled: z.boolean(),
        leakedPasswordProtectionEnabled: z.boolean(),
        minimumPasswordLength: z.number().int().nonnegative(),
        siteUrl: z.url(),
      })
      .strict(),
    usersByRole: countsSchema,
  })
  .strict();

const databaseSchema = z
  .object({
    migrations: z.array(z.string().min(1)),
    schema: z
      .object({
        extensions: z.array(
          z
            .object({ name: z.string().min(1), version: z.string().min(1) })
            .strict(),
        ),
        tables: z.array(z.string().min(1)),
      })
      .strict(),
    tableCounts: countsSchema,
  })
  .strict();

const storageSchema = z
  .object({
    buckets: z.array(
      z
        .object({
          name: z.string().min(1),
          objectCount: countSchema,
          totalBytes: countSchema,
        })
        .strict(),
    ),
  })
  .strict();

const recoverySchema = z
  .object({
    mechanism: z.literal("paused-supabase-project"),
    migrationDirectory: z.literal("supabase/migrations"),
    repository: z.string().regex(/^[^/]+\/[^/]+$/),
  })
  .strict();

const evidencePayloadSchema = z
  .object({
    auth: authSchema,
    capturedAt: z.iso.datetime(),
    database: databaseSchema,
    recovery: recoverySchema,
    source: sourceSchema,
    storage: storageSchema,
    version: z.literal(1),
  })
  .strict();

const evidenceSchema = evidencePayloadSchema
  .extend({ sha256: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();

export function createProductionBackupEvidence({
  auth,
  capturedAt,
  database,
  recovery,
  source,
  storage,
}) {
  const payload = evidencePayloadSchema.safeParse({
    auth,
    capturedAt,
    database: normalizeDatabase(database),
    recovery,
    source,
    storage: normalizeStorage(storage),
    version: 1,
  });
  if (!payload.success || containsPersonalIdentifier(payload.data)) {
    throw new Error("Invalid production backup evidence.");
  }

  return Object.freeze({
    ...payload.data,
    sha256: hashPayload(payload.data),
  });
}

export async function writeProductionBackupEvidence({ evidence, outputPath }) {
  const validated = validateEvidenceShape(evidence);
  const absoluteOutputPath = assertAuthorizedPath(outputPath);
  const outputDirectory = dirname(absoluteOutputPath);
  const temporaryPath = resolve(
    outputDirectory,
    `.${randomUUID()}.production-backup.tmp`,
  );
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });

  try {
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, absoluteOutputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }

  return { outputPath: absoluteOutputPath, sha256: validated.sha256 };
}

export async function readAndValidateProductionBackupEvidence({
  allowExpired = false,
  filePath,
  manifest,
  maximumAgeMs = /** @type {number | undefined} */ (undefined),
  now,
}) {
  const absolutePath = assertAuthorizedPath(filePath);
  let evidence;
  try {
    evidence = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    if (error instanceof Error && /hash/i.test(error.message)) throw error;
    throw new Error("Invalid production backup evidence file.");
  }

  return validateProductionBackupEvidence({
    allowExpired,
    evidence,
    manifest,
    maximumAgeMs,
    now,
  });
}

export function validateProductionBackupEvidence({
  allowExpired = false,
  evidence,
  manifest,
  maximumAgeMs = /** @type {number | undefined} */ (undefined),
  now,
}) {
  const validatedEvidence = validateEvidenceShape(evidence);

  const capturedAt = new Date(validatedEvidence.capturedAt).getTime();
  const currentTime =
    now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (capturedAt > currentTime) {
    throw new Error("Production backup evidence is from the future.");
  }
  if (!allowExpired) {
    if (!Number.isFinite(maximumAgeMs) || maximumAgeMs <= 0) {
      throw new Error("Invalid production backup evidence maximum age.");
    }
    if (currentTime - capturedAt > maximumAgeMs) {
      throw new Error("Production backup evidence is older than allowed.");
    }
  }

  const expected = manifest.supabase.legacy.production;
  if (
    validatedEvidence.source.organizationId !==
      manifest.supabase.organization.id ||
    validatedEvidence.source.projectRef !== expected.projectRef ||
    validatedEvidence.source.name !== expected.name ||
    validatedEvidence.source.region !== expected.region ||
    validatedEvidence.source.hostname !== expected.hostname
  ) {
    throw new Error("Production backup evidence source identity is divergent.");
  }

  return validatedEvidence;
}

function validateEvidenceShape(evidence) {
  const result = evidenceSchema.safeParse(evidence);
  if (!result.success || containsPersonalIdentifier(result.data)) {
    throw new Error("Invalid production backup evidence.");
  }
  const { sha256, ...payload } = result.data;
  if (hashPayload(payload) !== sha256) {
    throw new Error("Production backup evidence hash is invalid.");
  }
  return result.data;
}

function normalizeDatabase(database) {
  return {
    ...database,
    migrations: [...(database?.migrations ?? [])].sort(),
    schema: {
      extensions: [...(database?.schema?.extensions ?? [])].sort(
        (left, right) => left.name.localeCompare(right.name),
      ),
      tables: [...(database?.schema?.tables ?? [])].sort(),
    },
    tableCounts: sortRecord(database?.tableCounts ?? {}),
  };
}

function normalizeStorage(storage) {
  return {
    buckets: [...(storage?.buckets ?? [])].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
  };
}

function sortRecord(value) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function hashPayload(payload) {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function containsPersonalIdentifier(value) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(JSON.stringify(value));
}

function assertAuthorizedPath(filePath) {
  const absolutePath = resolve(filePath);
  const pathFromRoot = relative(authorizedRoot, absolutePath);
  if (
    pathFromRoot.length === 0 ||
    pathFromRoot.startsWith("..") ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error(
      "Evidence path must stay inside the authorized production backup directory.",
    );
  }
  return absolutePath;
}
