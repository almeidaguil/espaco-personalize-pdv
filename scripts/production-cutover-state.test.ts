import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  loadProductionCutoverState,
  recordProductionCutoverPhase,
} from "./production-cutover-state.mjs";

const statePath = resolve(".provisioning/production-cutover-state.json");

afterEach(async () => {
  await rm(statePath, { force: true });
});

describe("recordProductionCutoverPhase", () => {
  test("records every legal phase in monotonic order", async () => {
    let state = null;
    const transitions = legalTransitions();

    for (const [index, transition] of transitions.entries()) {
      state = await recordProductionCutoverPhase({
        facts: transition.facts,
        filePath: statePath,
        now: new Date(
          `2026-10-08T12:${String(index).padStart(2, "0")}:00.000Z`,
        ),
        phase: transition.phase,
        previousState: state,
      });
    }

    expect(state).not.toBeNull();
    if (!state) throw new Error("Expected final cutover state.");
    expect(state).toMatchObject({
      history: expect.arrayContaining([
        expect.objectContaining({ phase: "backup-recorded" }),
        expect.objectContaining({ phase: "production-created" }),
      ]),
      phase: "verified",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      version: 1,
    });
    expect(state.history).toHaveLength(9);
    await expect(
      loadProductionCutoverState({ filePath: statePath }),
    ).resolves.toEqual(state);
  });

  test("replays the same phase only when all facts are identical", async () => {
    const state = await recordProductionCutoverPhase({
      facts: legalTransitions()[0].facts,
      filePath: statePath,
      now: new Date("2026-10-08T12:00:00.000Z"),
      phase: "preflight",
      previousState: null,
    });

    await expect(
      recordProductionCutoverPhase({
        facts: legalTransitions()[0].facts,
        filePath: statePath,
        now: new Date("2026-10-08T13:00:00.000Z"),
        phase: "preflight",
        previousState: state,
      }),
    ).resolves.toEqual(state);

    await expect(
      recordProductionCutoverPhase({
        facts: { ...legalTransitions()[0].facts, commitSha: "b".repeat(40) },
        filePath: statePath,
        now: new Date("2026-10-08T13:00:00.000Z"),
        phase: "preflight",
        previousState: state,
      }),
    ).rejects.toThrow(/idempotent replay/i);
  });

  test("rejects skipped, regressed and stale transitions", async () => {
    await expect(
      recordProductionCutoverPhase({
        facts: legalTransitions()[1].facts,
        filePath: statePath,
        now: new Date("2026-10-08T12:00:00.000Z"),
        phase: "backup-recorded",
        previousState: null,
      }),
    ).rejects.toThrow(/next cutover phase/i);

    const preflight = await recordProductionCutoverPhase({
      facts: legalTransitions()[0].facts,
      filePath: statePath,
      now: new Date("2026-10-08T12:00:00.000Z"),
      phase: "preflight",
      previousState: null,
    });
    await expect(
      recordProductionCutoverPhase({
        facts: legalTransitions()[1].facts,
        filePath: statePath,
        now: new Date("2026-10-08T11:59:00.000Z"),
        phase: "backup-recorded",
        previousState: preflight,
      }),
    ).rejects.toThrow(/timestamp/i);
    const backup = await recordProductionCutoverPhase({
      facts: legalTransitions()[1].facts,
      filePath: statePath,
      now: new Date("2026-10-08T12:01:00.000Z"),
      phase: "backup-recorded",
      previousState: preflight,
    });

    await expect(
      recordProductionCutoverPhase({
        facts: legalTransitions()[0].facts,
        filePath: statePath,
        now: new Date("2026-10-08T12:02:00.000Z"),
        phase: "preflight",
        previousState: backup,
      }),
    ).rejects.toThrow(/regress|next cutover phase/i);
    await expect(
      recordProductionCutoverPhase({
        facts: legalTransitions()[2].facts,
        filePath: statePath,
        now: new Date("2026-10-08T12:02:00.000Z"),
        phase: "legacy-paused",
        previousState: preflight,
      }),
    ).rejects.toThrow(/stale cutover state/i);
  });

  test("rejects secret-like fields, e-mail values and paths outside the exact state file", async () => {
    await expect(
      recordProductionCutoverPhase({
        facts: { ...legalTransitions()[0].facts, token: "secret-sentinel" },
        filePath: statePath,
        now: new Date("2026-10-08T12:00:00.000Z"),
        phase: "preflight",
        previousState: null,
      }),
    ).rejects.toThrow(/cutover state/i);
    await expect(
      recordProductionCutoverPhase({
        facts: {
          ...legalTransitions()[0].facts,
          sourceRef: "owner@example.test",
        },
        filePath: statePath,
        now: new Date("2026-10-08T12:00:00.000Z"),
        phase: "preflight",
        previousState: null,
      }),
    ).rejects.toThrow(/cutover state/i);
    await expect(
      recordProductionCutoverPhase({
        facts: legalTransitions()[0].facts,
        filePath: resolve(".provisioning/other-state.json"),
        now: new Date("2026-10-08T12:00:00.000Z"),
        phase: "preflight",
        previousState: null,
      }),
    ).rejects.toThrow(/authorized cutover state path/i);
  });

  test("persists facts but no authorization capability or personal identifier", async () => {
    const state = await recordProductionCutoverPhase({
      facts: legalTransitions()[0].facts,
      filePath: statePath,
      now: new Date("2026-10-08T12:00:00.000Z"),
      phase: "preflight",
      previousState: null,
    });
    const serialized = JSON.stringify(state);

    expect(serialized).not.toMatch(
      /authorized|confirmation|execute|password|secret|token|email|@/i,
    );
    expect(state).not.toHaveProperty("authorized");
  });
});

describe("loadProductionCutoverState", () => {
  test("returns null for an absent state and rejects malformed or tampered state", async () => {
    await expect(
      loadProductionCutoverState({ filePath: statePath }),
    ).resolves.toBeNull();

    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(statePath, "not-json", "utf8");
    await expect(
      loadProductionCutoverState({ filePath: statePath }),
    ).rejects.toThrow(/invalid production cutover state/i);

    await rm(statePath, { force: true });
    const state = await recordProductionCutoverPhase({
      facts: legalTransitions()[0].facts,
      filePath: statePath,
      now: new Date("2026-10-08T12:00:00.000Z"),
      phase: "preflight",
      previousState: null,
    });
    const tampered = { ...state, phase: "verified" };
    await writeFile(statePath, JSON.stringify(tampered), "utf8");
    await expect(
      loadProductionCutoverState({ filePath: statePath }),
    ).rejects.toThrow(/hash|invalid production cutover state/i);
  });
});

function legalTransitions() {
  return [
    {
      facts: {
        commitSha: "a".repeat(40),
        manifestVersion: 2,
        sourceRef: "feature/production-cutover",
      },
      phase: "preflight",
    },
    {
      facts: {
        capturedAt: "2026-10-08T12:00:00.000Z",
        evidenceSha256: "b".repeat(64),
        sourceProjectRef: "ciixpfquwmlsvzleattv",
      },
      phase: "backup-recorded",
    },
    {
      facts: { projectRef: "ciixpfquwmlsvzleattv", status: "INACTIVE" },
      phase: "legacy-paused",
    },
    {
      facts: {
        hostname: "abcdefghijklmnopqrst.supabase.co",
        name: "roberto-multimarcas-pdv",
        organizationId: "wcqoluxxlvglqtebcucz",
        projectRef: "abcdefghijklmnopqrst",
        region: "sa-east-1",
      },
      phase: "production-created",
    },
    {
      facts: {
        authVerified: true,
        migrationHead: "20261008000000",
        projectRef: "abcdefghijklmnopqrst",
      },
      phase: "database-ready",
    },
    {
      facts: { adminCount: 1, operationalRowCount: 0, operatorCount: 0 },
      phase: "admin-ready",
    },
    {
      facts: {
        projectId: "prj_oBs2uc7uxsHMc7ssHFKczfi52LMq",
        variableNames: [
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          "NEXT_PUBLIC_SUPABASE_URL",
          "SUPABASE_SECRET_KEY",
        ],
      },
      phase: "vercel-configured",
    },
    {
      facts: {
        commitSha: "a".repeat(40),
        deploymentId: "dpl_Production123",
        deploymentUrl: "https://roberto-production-build.vercel.app",
        projectId: "prj_oBs2uc7uxsHMc7ssHFKczfi52LMq",
        siteUrl: "https://roberto-multimarcas-pdv.vercel.app",
        sourceRef: "feature/production-cutover",
      },
      phase: "deployment-ready",
    },
    {
      facts: {
        checks: ["database", "auth", "vercel", "smoke"],
        commitSha: "a".repeat(40),
        deploymentId: "dpl_Production123",
        smokeStatus: "passed",
      },
      phase: "verified",
    },
  ] as const;
}
