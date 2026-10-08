import { describe, expect, test, vi } from "vitest";

import remoteEnvironmentManifest from "../config/remote-environments.json";
import { runVercelProvisioning } from "./provision-vercel-project.mjs";

const manifest = structuredClone(remoteEnvironmentManifest);
const project = {
  framework: "nextjs",
  id: manifest.vercel.projectId,
  link: null,
  name: manifest.vercel.projectName,
  nodeVersion: "22.x",
  protectionBypass: {},
  ssoProtection: { deploymentType: "all_except_custom_domains" },
};

type Project = Omit<typeof project, "link" | "protectionBypass"> & {
  link: null | { repo: string };
  protectionBypass: Record<string, unknown> | null;
};
type Deployment = {
  id?: string;
  meta: {
    dedicated_staging: string;
    pr08: string;
    roberto_environment: string;
  };
  name: string;
  readyState: string;
  target: string;
  uid: string;
  url: string;
};
type EnvironmentVariables = {
  envs: Array<{ key: string; target: string[]; type: string }>;
};
type CreateClientOptions = {
  createdDeployment?: Partial<Deployment>;
  deployment?: Deployment | null;
  environmentVariables?: EnvironmentVariables;
  deploymentsByProject?: Record<
    string,
    { deployments: Array<{ uid: string }> }
  >;
  domainsByProject?: Record<string, { domains: Array<{ name: string }> }>;
  environmentVariablesByProject?: Record<string, EnvironmentVariables>;
  projectsById?: Record<string, Project>;
};

describe("runVercelProvisioning", () => {
  test("dry-run is read-only and does not require credentials", async () => {
    const client = createClient();
    const result = await runVercelProvisioning({
      args: ["--phase", "deploy-staging"],
      environment: {},
      log: vi.fn(),
      manifest,
      vercelClient: client,
    });

    expect(result.mode).toBe("dry-run");
    expect(client.getProject).not.toHaveBeenCalled();
    expect(client.createStagingDeployment).not.toHaveBeenCalled();
  });

  test("requires the literal dedicated staging project id for mutations", async () => {
    await expect(execute({ confirmation: "wrong-project" })).rejects.toThrow(
      /confirmação literal/i,
    );
  });

  test("configures three variables only for Production of the dedicated staging project", async () => {
    const client = createClient();
    const environment = stagingEnvironment();
    await execute({ client, environment, phase: "configure-staging" });

    expect(client.upsertProjectEnvironmentVariable).toHaveBeenCalledTimes(3);
    expect(client.upsertProjectEnvironmentVariable).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "SUPABASE_SECRET_KEY",
        targetEnvironment: "production",
        type: "sensitive",
      }),
    );
    expect(JSON.stringify(client.mock.mock.calls)).not.toContain(
      environment.SUPABASE_SECRET_KEY,
    );
  });

  test("rejects a non-dedicated project and deployments in the reserved production project", async () => {
    const unsafeManifest = structuredClone(manifest);
    unsafeManifest.vercel.dedicatedStaging = false as true;
    await expect(execute({ manifestOverride: unsafeManifest })).rejects.toThrow(
      /dedicated staging/i,
    );

    const reservedDeploymentClient = createClient({
      deploymentsByProject: {
        [manifest.vercel.reservedProductionProjectId]: {
          deployments: [{ uid: "dpl_real_prod" }],
        },
      },
    });
    await expect(execute({ client: reservedDeploymentClient })).rejects.toThrow(
      /reserved production project/i,
    );
  });

  test.each([
    [
      "environment variable",
      {
        environmentVariablesByProject: {
          [manifest.vercel.reservedProductionProjectId]: {
            envs: [
              { key: "UNEXPECTED", target: ["preview"], type: "encrypted" },
            ],
          },
        },
      },
    ],
    [
      "custom domain",
      {
        domainsByProject: {
          [manifest.vercel.reservedProductionProjectId]: {
            domains: [{ name: "reserved.example.test" }],
          },
        },
      },
    ],
  ])(
    "rejects a reserved production project containing %s",
    async (_kind, options) => {
      await expect(execute({ client: createClient(options) })).rejects.toThrow(
        /reserved production project/i,
      );
    },
  );

  test("rejects a divergent reserved production project identity", async () => {
    const projectsById = defaultProjects();
    projectsById[manifest.vercel.reservedProductionProjectId] = {
      ...projectsById[manifest.vercel.reservedProductionProjectId],
      name: "wrong-production-project",
    };

    await expect(
      execute({ client: createClient({ projectsById }) }),
    ).rejects.toThrow(/reserved production project identity/i);
  });

  test("rejects unexpected staging variables and temporary protection bypasses", async () => {
    const extraVariableClient = createClient({
      environmentVariables: {
        envs: [
          ...expectedEnvironmentVariables().envs,
          { key: "UNEXPECTED", target: ["production"], type: "encrypted" },
        ],
      },
    });
    await expect(execute({ client: extraVariableClient })).rejects.toThrow(
      /exactly three/i,
    );
    expect(
      extraVariableClient.upsertProjectEnvironmentVariable,
    ).not.toHaveBeenCalled();

    const projectsById = defaultProjects();
    projectsById[manifest.vercel.projectId] = {
      ...projectsById[manifest.vercel.projectId],
      protectionBypass: { temporary: { scope: "automation-bypass" } },
    };
    await expect(
      execute({ client: createClient({ projectsById }) }),
    ).rejects.toThrow(/protection bypass/i);
  });

  test("deploys from the approved Git source into Production of the dedicated staging project", async () => {
    const client = createClient({
      deployment: readyDeployment(),
      deploymentsByProject: {
        [manifest.vercel.projectId]: { deployments: [] },
      },
    });
    const result = await execute({
      client,
      manifestOverride: manifestWithoutDeployment(),
      phase: "deploy-staging",
    });

    expect(client.createStagingDeployment).toHaveBeenCalledWith({
      branch: "feature/provision-roberto-environments",
      orgId: manifest.vercel.orgId,
      projectId: manifest.vercel.projectId,
      projectName: manifest.vercel.projectName,
      repositoryId: 1264018806,
    });
    expect(result).toMatchObject({
      deploymentId: "dpl_staging123",
      deploymentUrl: "https://roberto-staging-build.vercel.app",
    });
  });

  test("refuses to create a duplicate after a staging deployment is persisted", async () => {
    const client = createClient();
    await expect(execute({ client, phase: "deploy-staging" })).rejects.toThrow(
      /already persisted/i,
    );
    expect(client.createStagingDeployment).not.toHaveBeenCalled();
  });

  test("verifies the persisted staging deployment and its metadata", async () => {
    const client = createClient({
      deployment: readyDeployment({
        uid: manifest.vercel.deploymentId,
        url: "roberto-multimarcas-pdv-staging-6emhr7cxk.vercel.app",
      }),
    });
    const result = await execute({ client, phase: "verify-staging" });

    expect(result).toMatchObject({
      deploymentId: manifest.vercel.deploymentId,
      siteUrl: "https://roberto-multimarcas-pdv-staging.vercel.app",
    });
  });
});

function stagingEnvironment() {
  return {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-sentinel",
    NEXT_PUBLIC_SUPABASE_URL: "https://otsxpchqtfypxgzjzrxs.supabase.co",
    SUPABASE_SECRET_KEY: "service-secret-sentinel",
  };
}

function readyDeployment(override: Partial<Deployment> = {}): Deployment {
  return {
    meta: {
      dedicated_staging: "true",
      pr08: "true",
      roberto_environment: "staging",
    },
    name: manifest.vercel.projectName,
    readyState: "READY",
    target: "production",
    uid: "dpl_staging123",
    url: "roberto-staging-build.vercel.app",
    ...override,
  };
}

function manifestWithoutDeployment() {
  return {
    ...structuredClone(manifest),
    vercel: {
      ...structuredClone(manifest.vercel),
      deploymentId: null,
      deploymentUrl: null,
    },
  } as unknown as typeof manifest;
}

function createClient({
  createdDeployment = { id: "dpl_staging123", target: "production" },
  deployment = readyDeployment(),
  environmentVariables = expectedEnvironmentVariables(),
  deploymentsByProject = {},
  domainsByProject = {},
  environmentVariablesByProject = {},
  projectsById = defaultProjects(),
}: CreateClientOptions = {}) {
  const mock = vi.fn();
  return {
    createStagingDeployment: vi.fn().mockResolvedValue(createdDeployment),
    getDeployment: vi.fn().mockResolvedValue(deployment),
    getProject: vi
      .fn()
      .mockImplementation((projectId: string) =>
        Promise.resolve(projectsById[projectId]),
      ),
    listProjectDeployments: vi.fn().mockImplementation((projectId: string) =>
      Promise.resolve(
        deploymentsByProject[projectId] ?? {
          deployments:
            projectId === manifest.vercel.projectId &&
            manifest.vercel.deploymentId
              ? [{ uid: manifest.vercel.deploymentId }]
              : [],
        },
      ),
    ),
    listProjectDomains: vi.fn().mockImplementation((projectId: string) =>
      Promise.resolve(
        domainsByProject[projectId] ?? {
          domains:
            projectId === manifest.vercel.reservedProductionProjectId
              ? [
                  {
                    name: `${manifest.vercel.reservedProductionProjectName}.vercel.app`,
                  },
                ]
              : [],
        },
      ),
    ),
    listProjectEnvironmentVariables: vi
      .fn()
      .mockImplementation((projectId: string) =>
        Promise.resolve(
          environmentVariablesByProject[projectId] ??
            (projectId === manifest.vercel.projectId
              ? environmentVariables
              : { envs: [] }),
        ),
      ),
    mock,
    upsertProjectEnvironmentVariable: vi
      .fn()
      .mockImplementation(
        (value: { key: string; targetEnvironment: string; type: string }) => {
          mock({
            key: value.key,
            targetEnvironment: value.targetEnvironment,
            type: value.type,
          });
          return Promise.resolve({ created: true });
        },
      ),
  };
}

function defaultProjects(): Record<string, Project> {
  return {
    [manifest.vercel.projectId]: structuredClone(project),
    [manifest.vercel.reservedProductionProjectId]: {
      ...structuredClone(project),
      id: manifest.vercel.reservedProductionProjectId,
      name: manifest.vercel.reservedProductionProjectName,
    },
  };
}

function expectedEnvironmentVariables(): EnvironmentVariables {
  return {
    envs: [
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
    ],
  };
}

type ExecuteOptions = {
  client?: ReturnType<typeof createClient>;
  confirmation?: string;
  environment?: ReturnType<typeof stagingEnvironment>;
  manifestOverride?: typeof manifest;
  phase?: string;
};

function execute({
  client = createClient(),
  confirmation = manifest.vercel.projectId,
  environment = stagingEnvironment(),
  manifestOverride = manifest,
  phase = "configure-staging",
}: ExecuteOptions = {}) {
  return runVercelProvisioning({
    args: ["--phase", phase, "--execute", "--confirm-project", confirmation],
    environment,
    log: vi.fn(),
    manifest: manifestOverride,
    vercelClient: client,
    wait: vi.fn(),
  });
}
