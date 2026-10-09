import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { z } from "zod";

const authorizedStatePath = resolve(
  ".provisioning/production-cutover-state.json",
);
const projectRefSchema = z.string().regex(/^[a-z]{20}$/);
const projectIdSchema = z.string().regex(/^prj_[A-Za-z0-9]+$/);
const deploymentIdSchema = z.string().regex(/^dpl_[A-Za-z0-9]+$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const commitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const sourceRefSchema = z.union([
  z.literal("feature/production-cutover"),
  z.literal("main"),
]);
const httpsUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
});

const phaseSchemas = {
  preflight: z
    .object({
      commitSha: commitShaSchema,
      manifestVersion: z.literal(2),
      sourceRef: sourceRefSchema,
    })
    .strict(),
  "backup-recorded": z
    .object({
      capturedAt: z.iso.datetime(),
      evidenceSha256: sha256Schema,
      sourceProjectRef: projectRefSchema,
    })
    .strict(),
  "legacy-paused": z
    .object({ projectRef: projectRefSchema, status: z.literal("INACTIVE") })
    .strict(),
  "production-created": z
    .object({
      hostname: z.string().regex(/^[a-z]{20}\.supabase\.co$/),
      name: z.literal("roberto-multimarcas-pdv"),
      organizationId: projectRefSchema,
      projectRef: projectRefSchema,
      region: z.literal("sa-east-1"),
    })
    .strict(),
  "database-ready": z
    .object({
      authVerified: z.literal(true),
      migrationHead: z.string().regex(/^\d{14}$/),
      projectRef: projectRefSchema,
    })
    .strict(),
  "admin-ready": z
    .object({
      adminCount: z.literal(1),
      operationalRowCount: z.literal(0),
      operatorCount: z.literal(0),
    })
    .strict(),
  "vercel-configured": z
    .object({
      projectId: projectIdSchema,
      variableNames: z
        .array(
          z.enum([
            "NEXT_PUBLIC_SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
            "SUPABASE_SECRET_KEY",
          ]),
        )
        .length(3)
        .refine((values) => new Set(values).size === 3),
    })
    .strict(),
  "deployment-ready": z
    .object({
      commitSha: commitShaSchema,
      deploymentId: deploymentIdSchema,
      deploymentUrl: httpsUrlSchema,
      projectId: projectIdSchema,
      siteUrl: z.literal("https://roberto-multimarcas-pdv.vercel.app"),
      sourceRef: sourceRefSchema,
    })
    .strict(),
  verified: z
    .object({
      checks: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
      commitSha: commitShaSchema,
      deploymentId: deploymentIdSchema,
      smokeStatus: z.literal("passed"),
    })
    .strict(),
};

const phases = Object.freeze([
  "preflight",
  "backup-recorded",
  "legacy-paused",
  "production-created",
  "database-ready",
  "admin-ready",
  "vercel-configured",
  "deployment-ready",
  "verified",
]);

const historyEntrySchema = z.discriminatedUnion("phase", [
  historyEntry("preflight"),
  historyEntry("backup-recorded"),
  historyEntry("legacy-paused"),
  historyEntry("production-created"),
  historyEntry("database-ready"),
  historyEntry("admin-ready"),
  historyEntry("vercel-configured"),
  historyEntry("deployment-ready"),
  historyEntry("verified"),
]);

const statePayloadSchema = z
  .object({
    history: z.array(historyEntrySchema).min(1).max(phases.length),
    phase: z.enum(phases),
    updatedAt: z.iso.datetime(),
    version: z.literal(1),
  })
  .strict()
  .superRefine((state, context) => {
    const expectedPhases = phases.slice(0, state.history.length);
    if (
      state.history.some(
        (entry, index) => entry.phase !== expectedPhases[index],
      ) ||
      state.phase !== state.history.at(-1)?.phase ||
      state.updatedAt !== state.history.at(-1)?.completedAt
    ) {
      context.addIssue({ code: "custom", message: "invalid phase history" });
    }
  });

const stateSchema = statePayloadSchema
  .safeExtend({ sha256: sha256Schema })
  .strict();

export async function loadProductionCutoverState({ filePath }) {
  const absolutePath = assertAuthorizedStatePath(filePath);
  let contents;
  try {
    contents = await readFile(absolutePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw new Error("Unable to read production cutover state.");
  }

  try {
    return validateState(JSON.parse(contents));
  } catch {
    throw new Error("Invalid production cutover state or hash.");
  }
}

export async function recordProductionCutoverPhase({
  facts,
  filePath,
  now,
  phase,
  previousState,
}) {
  const absolutePath = assertAuthorizedStatePath(filePath);
  const completedAt = toIsoDate(now);
  const parsedFacts = parsePhaseFacts(phase, facts);
  const persistedState = await loadProductionCutoverState({
    filePath: absolutePath,
  });
  assertPreviousState(previousState, persistedState);

  const desiredIndex = phases.indexOf(phase);
  const currentIndex = persistedState
    ? phases.indexOf(persistedState.phase)
    : -1;
  if (desiredIndex === currentIndex) {
    const persistedFacts = persistedState.history.at(-1).facts;
    if (canonicalize(persistedFacts) !== canonicalize(parsedFacts)) {
      throw new Error("Cutover phase idempotent replay has divergent facts.");
    }
    return persistedState;
  }
  if (desiredIndex !== currentIndex + 1) {
    throw new Error("The requested phase is not the next cutover phase.");
  }
  if (
    persistedState &&
    new Date(completedAt).getTime() <
      new Date(persistedState.updatedAt).getTime()
  ) {
    throw new Error("Production cutover state timestamp cannot regress.");
  }

  const payload = statePayloadSchema.parse({
    history: [
      ...(persistedState?.history ?? []),
      { completedAt, facts: parsedFacts, phase },
    ],
    phase,
    updatedAt: completedAt,
    version: 1,
  });
  const state = validateState({
    ...payload,
    sha256: hashPayload(payload),
  });
  await writeStateAtomically(absolutePath, state);
  return state;
}

function historyEntry(phase) {
  return z
    .object({
      completedAt: z.iso.datetime(),
      facts: phaseSchemas[phase],
      phase: z.literal(phase),
    })
    .strict();
}

function parsePhaseFacts(phase, facts) {
  const schema = phaseSchemas[phase];
  if (!schema) throw new Error("Invalid production cutover state phase.");
  const normalizedFacts =
    phase === "vercel-configured"
      ? { ...facts, variableNames: [...(facts?.variableNames ?? [])].sort() }
      : phase === "verified"
        ? { ...facts, checks: [...(facts?.checks ?? [])].sort() }
        : facts;
  const result = schema.safeParse(normalizedFacts);
  if (!result.success || containsPersonalIdentifier(result.data)) {
    throw new Error("Invalid production cutover state facts.");
  }
  return result.data;
}

function validateState(value) {
  const result = stateSchema.safeParse(value);
  if (!result.success || containsPersonalIdentifier(result.data)) {
    throw new Error("Invalid production cutover state.");
  }
  const { sha256, ...payload } = result.data;
  if (hashPayload(payload) !== sha256) {
    throw new Error("Production cutover state hash is invalid.");
  }
  return result.data;
}

function assertPreviousState(previousState, persistedState) {
  if (!previousState && !persistedState) return;
  if (!previousState || !persistedState) {
    throw new Error("Stale cutover state detected.");
  }
  const parsedPrevious = validateState(previousState);
  if (parsedPrevious.sha256 !== persistedState.sha256) {
    throw new Error("Stale cutover state detected.");
  }
}

async function writeStateAtomically(filePath, state) {
  const directory = dirname(filePath);
  const temporaryPath = resolve(directory, `.${randomUUID()}.cutover.tmp`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function assertAuthorizedStatePath(filePath) {
  const absolutePath = resolve(filePath);
  if (absolutePath !== authorizedStatePath) {
    throw new Error("State must use the authorized cutover state path.");
  }
  return absolutePath;
}

function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid production cutover state timestamp.");
  }
  return date.toISOString();
}

function containsPersonalIdentifier(value) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(JSON.stringify(value));
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
