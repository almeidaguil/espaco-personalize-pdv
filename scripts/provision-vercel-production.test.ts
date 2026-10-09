import { describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import {
  runProvisionVercelProductionCli,
  runVercelProductionProvisioning,
} from "./provision-vercel-production.mjs";

const projectId = "prj_oBs2uc7uxsHMc7ssHFKczfi52LMq";
const orgId = "team_jstETBWBHJi0hsir3a3bAkbK";
const projectName = "roberto-multimarcas-pdv";
const siteUrl = "https://roberto-multimarcas-pdv.vercel.app";
const sourceRef = "feature/production-cutover";
const commitSha = "a".repeat(40);
const projectRef = "abcdefghijklmnopqrst";
const secretKey = "supabase-service-secret-sentinel";

describe("runVercelProductionProvisioning", () => {
  test("audits the exact empty reserved project without any mutation", async () => {
    const client = createClient();

    const result = await run({ client, options: { phase: "audit" } });

    expect(result).toMatchObject({
      mode: "audited",
      phase: "audit",
      projectId,
      projectName,
      siteUrl,
    });
    expect(client.mutations).toHaveLength(0);
  });

  test.each([
    ["Next.js preset", { project: { framework: "other" } }, /framework/i],
    ["Node 22", { project: { nodeVersion: "20.x" } }, /Node/i],
    [
      "first-use deployment",
      { deployments: [readyDeployment()] },
      /empty|first-use/i,
    ],
    [
      "first-use variable",
      { variables: [expectedVariables()[0]] },
      /empty|first-use/i,
    ],
    ["default domain", { domains: [{ name: "custom.test" }] }, /domain/i],
    [
      "deployment protection",
      { project: { ssoProtection: { deploymentType: "all" } } },
      /protection/i,
    ],
    [
      "protection bypass",
      {
        project: {
          protectionBypass: { temporary: { scope: "automation-bypass" } },
        },
      },
      /bypass/i,
    ],
  ])("rejects divergent production audit: %s", async (_name, setup, error) => {
    const client = createClient(setup);

    await expect(run({ client, options: { phase: "audit" } })).rejects.toThrow(
      error,
    );
    expect(client.mutations).toHaveLength(0);
  });

  test("configures exactly three Production variables and records only their names", async () => {
    const client = createClient();
    const logger = vi.fn();
    const recordPhase = vi.fn(async ({ phase }) => ({ phase }));

    const result = await run({ client, logger, recordPhase });

    expect(client.variables).toEqual(expectedVariables());
    expect(client.mutations).toEqual([
      { key: "NEXT_PUBLIC_SUPABASE_URL", projectId },
      { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", projectId },
      { key: "SUPABASE_SECRET_KEY", projectId },
    ]);
    expect(recordPhase).toHaveBeenCalledWith({
      facts: {
        projectId,
        variableNames: [
          "NEXT_PUBLIC_SUPABASE_URL",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          "SUPABASE_SECRET_KEY",
        ],
      },
      phase: "vercel-configured",
      previousState: expect.objectContaining({ phase: "admin-ready" }),
    });
    expect(JSON.stringify({ result, logs: logger.mock.calls })).not.toContain(
      secretKey,
    );
  });

  test("rejects mutation without literal confirmation or with a non-reserved target", async () => {
    const client = createClient();
    await expect(
      run({ client, options: { execute: true, phase: "configure" } }),
    ).rejects.toThrow(/literal|confirm/i);
    expect(client.mutations).toHaveLength(0);

    const manifest = persistedManifest();
    manifest.vercel.orgId = "team_AAAAAAAAAAAAAAAAAAAA";
    manifest.vercel.targets.production.projectId =
      "prj_AAAAAAAAAAAAAAAAAAAAAAAA";
    await expect(run({ client, manifest })).rejects.toThrow(/reserved/i);
    expect(client.mutations).toHaveLength(0);
  });

  test("rejects cutover state bound to another Supabase or Vercel target", async () => {
    const client = createClient();
    await expect(
      run({ client, state: adminState("zyxwvutsrqponmlkjihg") }),
    ).rejects.toThrow(/state.*target|divergent/i);
    expect(client.mutations).toHaveLength(0);

    const wrongVercelState = configuredState();
    const configuredEntry = wrongVercelState.history.find(
      (entry) => entry.phase === "vercel-configured",
    )!;
    (configuredEntry.facts as { projectId: string }).projectId =
      "prj_AAAAAAAAAAAAAAAAAAAAAAAA";
    await expect(
      run({ client, options: deployOptions(), state: wrongVercelState }),
    ).rejects.toThrow(/state.*target|divergent/i);
    expect(client.createGitDeployment).not.toHaveBeenCalled();
  });

  test.each([
    [
      "an extra variable",
      [
        ...expectedVariables(),
        { key: "EXTRA", target: ["production"], type: "encrypted" },
      ],
      undefined,
    ],
    [
      "a missing variable after a configured state",
      expectedVariables().slice(0, 2),
      "configured",
    ],
    [
      "a service key lacking the sensitive flag",
      expectedVariables().map((entry) =>
        entry.key === "SUPABASE_SECRET_KEY"
          ? { ...entry, type: "encrypted" }
          : entry,
      ),
      undefined,
    ],
  ])("rejects %s before mutating", async (_name, variables, stateKind) => {
    const client = createClient({ variables });
    const state = stateKind === "configured" ? configuredState() : adminState();

    await expect(run({ client, state })).rejects.toThrow(
      /exactly|variable|sensitive/i,
    );
    expect(client.mutations).toHaveLength(0);
  });

  test("resumes partial variable configuration without duplicating existing values", async () => {
    const client = createClient({ failAtUpsert: 2 });

    await expect(run({ client })).rejects.toThrow(/injected/i);
    expect(client.variables).toHaveLength(1);

    await expect(run({ client })).resolves.toMatchObject({
      configuredVariables: expect.arrayContaining([
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SECRET_KEY",
      ]),
    });
    expect(client.variables).toEqual(expectedVariables());
    expect(new Set(client.variables.map(({ key }) => key)).size).toBe(3);
  });

  test("deploys the exact allowed ref and commit, then records READY plus stable alias", async () => {
    const client = createClient({ variables: expectedVariables() });
    const recordPhase = vi.fn(async ({ phase }) => ({ phase }));

    const result = await run({
      client,
      options: deployOptions(),
      recordPhase,
      state: configuredState(),
    });

    expect(client.createGitDeployment).toHaveBeenCalledWith({
      environment: "production",
      metadata: {
        pr09: "true",
        roberto_commit_sha: commitSha,
        roberto_environment: "production",
        roberto_source_ref: sourceRef,
      },
      orgId,
      projectId,
      ref: commitSha,
      repositoryId: 1264018806,
    });
    expect(result).toMatchObject({
      commitSha,
      deploymentId: "dpl_Production123",
      deploymentUrl: "https://roberto-production-build.vercel.app",
      siteUrl,
      sourceRef,
    });
    expect(recordPhase).toHaveBeenCalledWith({
      facts: {
        commitSha,
        deploymentId: "dpl_Production123",
        deploymentUrl: "https://roberto-production-build.vercel.app",
        projectId,
        siteUrl,
        sourceRef,
      },
      phase: "deployment-ready",
      previousState: expect.objectContaining({ phase: "vercel-configured" }),
    });
  });

  test("resumes after deployment creation without creating a duplicate", async () => {
    const client = createClient({
      createThrowsAfterPersist: true,
      variables: expectedVariables(),
    });
    const recordPhase = vi.fn(async ({ phase }) => ({ phase }));

    await expect(
      run({
        client,
        options: deployOptions(),
        recordPhase,
        state: configuredState(),
      }),
    ).rejects.toThrow(/injected/i);

    await expect(
      run({
        client,
        options: deployOptions(),
        recordPhase,
        state: configuredState(),
      }),
    ).resolves.toMatchObject({ deploymentId: "dpl_Production123" });
    expect(client.createGitDeployment).toHaveBeenCalledTimes(1);
    expect(recordPhase).toHaveBeenCalledTimes(1);
  });

  test("rejects a forbidden ref, wrong phase and deployment without the stable alias", async () => {
    const client = createClient({ variables: expectedVariables() });
    await expect(
      run({
        client,
        options: { ...deployOptions(), sourceRef: "develop" },
        state: configuredState(),
      }),
    ).rejects.toThrow(/allowed|source ref/i);
    await expect(
      run({ client, options: deployOptions(), state: adminState() }),
    ).rejects.toThrow(/vercel-configured/i);

    const aliasClient = createClient({
      deployment: readyDeployment({ alias: ["other.vercel.app"] }),
      variables: expectedVariables(),
    });
    await expect(
      run({
        client: aliasClient,
        options: deployOptions(),
        state: configuredState(),
      }),
    ).rejects.toThrow(/alias/i);
    expect(client.createAutomationBypass).not.toHaveBeenCalled();
  });

  test("rejects deploy when the authorized ref does not resolve to the requested SHA", async () => {
    const client = createClient({ variables: expectedVariables() });
    await expect(
      run({
        client,
        options: deployOptions(),
        resolveSourceCommit: vi.fn().mockResolvedValue("b".repeat(40)),
        state: configuredState(),
      }),
    ).rejects.toThrow(/resolve.*commit/i);
    expect(client.createGitDeployment).not.toHaveBeenCalled();
  });

  test("dry-run executes state, source and provider gates without mutating", async () => {
    const client = createClient({ variables: expectedVariables() });
    await expect(
      run({
        client,
        options: { ...deployOptions(), execute: false },
        state: configuredState(),
      }),
    ).resolves.toMatchObject({ mode: "dry-run" });
    expect(client.createGitDeployment).not.toHaveBeenCalled();

    await expect(
      run({
        client,
        options: { ...deployOptions(), execute: false, sourceRef: "develop" },
        state: configuredState(),
      }),
    ).rejects.toThrow(/allowed/i);
  });

  test("rejects a deployment whose Git source disagrees with its metadata", async () => {
    const client = createClient({
      deployment: readyDeployment({
        gitSource: {
          ref: "main",
          repoId: 999,
          sha: "b".repeat(40),
        },
      }),
      variables: expectedVariables(),
    });

    await expect(
      run({ client, options: deployOptions(), state: configuredState() }),
    ).rejects.toThrow(/commit|source|repository/i);
  });

  test.each([
    ["commit", { ref: commitSha, repoId: 1264018806 }],
    ["ref", { repoId: 1264018806, sha: commitSha }],
    ["repository", { ref: commitSha, sha: commitSha }],
  ])(
    "rejects deployment without provider Git %s proof",
    async (_name, gitSource) => {
      const client = createClient({
        deployment: readyDeployment({ gitSource }),
        variables: expectedVariables(),
      });

      await expect(
        run({ client, options: deployOptions(), state: configuredState() }),
      ).rejects.toThrow(/commit|source|repository/i);
    },
  );

  test("verifies the persisted deployment read-only from deployment-ready state", async () => {
    const client = createClient({
      deployments: [readyDeployment()],
      variables: expectedVariables(),
    });

    const result = await run({
      client,
      options: { phase: "verify" },
      state: deploymentState(),
    });

    expect(result).toMatchObject({
      deploymentId: "dpl_Production123",
      mode: "verified",
    });
    expect(client.mutations).toHaveLength(0);
    expect(client.createAutomationBypass).not.toHaveBeenCalled();
  });

  test("audits and deploys main after provisional verification without regressing state", async () => {
    const mainSha = "b".repeat(40);
    const prior = readyDeployment();
    const main = readyDeployment({
      gitSource: { ref: mainSha, repoId: 1264018806, sha: mainSha },
      meta: {
        pr09: "true",
        roberto_commit_sha: mainSha,
        roberto_environment: "production",
        roberto_source_ref: "main",
      },
      uid: "dpl_MainProduction456",
      url: "roberto-main-build.vercel.app",
    });
    const auditClient = createClient({
      deployment: prior,
      deployments: [prior],
      variables: expectedVariables(),
    });
    const client = createClient({
      deployment: main,
      deployments: [prior],
      variables: expectedVariables(),
    });
    const state = verifiedState();
    await expect(
      run({ client: auditClient, options: { phase: "audit" }, state }),
    ).resolves.toMatchObject({ mode: "audited" });

    const recordPhase = vi.fn();
    await expect(
      run({
        client,
        options: {
          commitSha: mainSha,
          confirmation: projectId,
          execute: true,
          phase: "deploy",
          sourceRef: "main",
        },
        recordPhase,
        state,
      }),
    ).resolves.toMatchObject({
      deploymentId: "dpl_MainProduction456",
      sourceRef: "main",
    });
    expect(recordPhase).not.toHaveBeenCalled();

    await expect(
      run({
        client,
        options: { commitSha: mainSha, phase: "verify", sourceRef: "main" },
        state,
      }),
    ).resolves.toMatchObject({
      deploymentId: "dpl_MainProduction456",
      mode: "verified",
      sourceRef: "main",
    });
  });
});

describe("runProvisionVercelProductionCli", () => {
  test("prints help without loading state, secrets or providers", async () => {
    const loadManifest = vi.fn();
    const loadState = vi.fn();
    const logger = vi.fn();

    await expect(
      runProvisionVercelProductionCli(["--help"], {
        loadManifest,
        loadState,
        logger,
      }),
    ).resolves.toBeUndefined();
    expect(loadManifest).not.toHaveBeenCalled();
    expect(loadState).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith(
      expect.stringMatching(/audit.*configure.*deploy.*verify/i),
    );
  });
});

function run({
  client = createClient(),
  environment = productionEnvironment(),
  logger = vi.fn(),
  manifest = persistedManifest(),
  options = configureOptions(),
  recordPhase = vi.fn(async ({ phase }) => ({ phase })),
  resolveSourceCommit = vi.fn(async () =>
    typeof options.commitSha === "string" ? options.commitSha : commitSha,
  ),
  state = adminState(),
}: {
  client?: ReturnType<typeof createClient>;
  environment?: ReturnType<typeof productionEnvironment>;
  logger?: ReturnType<typeof vi.fn>;
  manifest?: ReturnType<typeof persistedManifest>;
  options?: Record<string, unknown>;
  recordPhase?: ReturnType<typeof vi.fn>;
  resolveSourceCommit?: ReturnType<typeof vi.fn>;
  state?: CutoverState;
} = {}) {
  return runVercelProductionProvisioning({
    client,
    environment,
    logger,
    manifest,
    options,
    recordPhase,
    resolveSourceCommit,
    state,
    wait: vi.fn(),
  });
}

function configureOptions() {
  return { confirmation: projectId, execute: true, phase: "configure" };
}

function deployOptions() {
  return {
    commitSha,
    confirmation: projectId,
    execute: true,
    phase: "deploy",
    sourceRef,
  };
}

function productionEnvironment() {
  return {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-production-sentinel",
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    SUPABASE_SECRET_KEY: secretKey,
    VERCEL_TOKEN: "vercel-token-sentinel",
  };
}

function persistedManifest() {
  const manifest = structuredClone(manifestFixture);
  return {
    ...manifest,
    supabase: {
      ...manifest.supabase,
      targets: {
        ...manifest.supabase.targets,
        production: {
          ...manifest.supabase.targets.production,
          hostname: `${projectRef}.supabase.co`,
          projectRef,
        },
      },
    },
  };
}

function adminState(ref = projectRef) {
  return {
    history: baseHistory(ref),
    phase: "admin-ready",
  };
}

function configuredState() {
  return {
    history: [
      ...baseHistory(),
      {
        facts: {
          projectId,
          variableNames: [
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
            "NEXT_PUBLIC_SUPABASE_URL",
            "SUPABASE_SECRET_KEY",
          ],
        },
        phase: "vercel-configured",
      },
    ],
    phase: "vercel-configured",
  };
}

function deploymentState() {
  return {
    history: [
      ...configuredState().history,
      {
        facts: {
          commitSha,
          deploymentId: "dpl_Production123",
          deploymentUrl: "https://roberto-production-build.vercel.app",
          projectId,
          siteUrl,
          sourceRef,
        },
        phase: "deployment-ready",
      },
    ],
    phase: "deployment-ready",
  };
}

function verifiedState() {
  return {
    history: [
      ...deploymentState().history,
      { facts: { deploymentId: "dpl_Production123" }, phase: "verified" },
    ],
    phase: "verified",
  };
}

function baseHistory(ref = projectRef) {
  return [
    { facts: { projectRef: ref }, phase: "production-created" },
    { facts: { projectRef: ref }, phase: "database-ready" },
    { facts: {}, phase: "admin-ready" },
  ];
}

function expectedVariables() {
  return [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      target: ["production"],
      type: "encrypted",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      target: ["production"],
      type: "encrypted",
    },
    {
      key: "SUPABASE_SECRET_KEY",
      target: ["production"],
      type: "sensitive",
    },
  ];
}

function readyDeployment(override: Record<string, unknown> = {}) {
  return {
    alias: ["roberto-multimarcas-pdv.vercel.app"],
    gitSource: { ref: commitSha, repoId: 1264018806, sha: commitSha },
    meta: {
      pr09: "true",
      roberto_commit_sha: commitSha,
      roberto_environment: "production",
      roberto_source_ref: sourceRef,
    },
    name: projectName,
    readyState: "READY",
    target: "production",
    uid: "dpl_Production123",
    url: "roberto-production-build.vercel.app",
    ...override,
  };
}

function createClient({
  createThrowsAfterPersist = false,
  deployment = readyDeployment(),
  deployments = [],
  domains = [{ name: "roberto-multimarcas-pdv.vercel.app" }],
  failAtUpsert = 0,
  project = {},
  variables = [],
}: {
  createThrowsAfterPersist?: boolean;
  deployment?: ReturnType<typeof readyDeployment>;
  deployments?: ReturnType<typeof readyDeployment>[];
  domains?: { name: string }[];
  failAtUpsert?: number;
  project?: Record<string, unknown>;
  variables?: ReturnType<typeof expectedVariables>;
} = {}) {
  const currentVariables = structuredClone(variables);
  const currentDeployments = structuredClone(deployments);
  const mutations: { key: string; projectId: string }[] = [];
  let upsertAttempt = 0;
  let failCreation = createThrowsAfterPersist;
  const createGitDeployment = vi.fn(async () => {
    if (
      !currentDeployments.some((candidate) => candidate.uid === deployment.uid)
    ) {
      currentDeployments.push(structuredClone(deployment));
    }
    if (failCreation) {
      failCreation = false;
      throw new Error("injected deployment response failure");
    }
    return { id: "dpl_Production123", target: "production" };
  });
  const upsertProjectEnvironmentVariable = vi.fn(
    async (input: {
      key: string;
      projectId: string;
      targetEnvironment: string;
      type: string;
    }) => {
      upsertAttempt += 1;
      if (upsertAttempt === failAtUpsert) {
        throw new Error("injected variable failure");
      }
      mutations.push({ key: input.key, projectId: input.projectId });
      const existingIndex = currentVariables.findIndex(
        (entry) => entry.key === input.key,
      );
      if (existingIndex !== -1) currentVariables.splice(existingIndex, 1);
      currentVariables.push({
        key: input.key,
        target: [input.targetEnvironment],
        type: input.type,
      });
      return { created: true };
    },
  );
  return {
    createAutomationBypass: vi.fn(),
    createGitDeployment,
    getDeployment: vi.fn(async () => structuredClone(deployment)),
    getProject: vi.fn(async () => ({
      framework: "nextjs",
      id: projectId,
      link: null,
      name: projectName,
      nodeVersion: "22.x",
      protectionBypass: {},
      ssoProtection: null,
      ...project,
    })),
    listProjectDeployments: vi.fn(async () => ({
      deployments: structuredClone(currentDeployments),
    })),
    listProjectDomains: vi.fn(async () => ({
      domains: structuredClone(domains),
    })),
    listProjectEnvironmentVariables: vi.fn(async () => ({
      envs: structuredClone(currentVariables),
    })),
    mutations,
    upsertProjectEnvironmentVariable,
    variables: currentVariables,
  };
}

type CutoverState = {
  history: { facts?: Record<string, unknown>; phase: string }[];
  phase: string;
};
