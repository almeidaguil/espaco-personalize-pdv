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
};

type Project = Omit<typeof project, "link"> & {
  link: null | { repo: string };
};
type Deployment = {
  meta: { pr08: string; roberto_environment: string };
  name: string;
  readyState: string;
  target: null | string;
  uid: string;
  url: string;
};
type EnvironmentVariables = {
  envs: Array<{ key: string; target: string[]; type: string }>;
};
type CreateClientOptions = {
  createdTarget?: null | string;
  deployment?: Deployment | null;
  environmentVariables?: EnvironmentVariables;
  productionDeployments?: { deployments: Array<{ uid: string }> };
  project?: Project;
};

describe("runVercelProvisioning", () => {
  test("dry-run is read-only and does not require credentials", async () => {
    const client = createClient();

    const result = await runVercelProvisioning({
      args: ["--phase", "deploy-preview"],
      environment: {},
      log: vi.fn(),
      manifest,
      vercelClient: client,
    });

    expect(result.mode).toBe("dry-run");
    expect(client.getProject).not.toHaveBeenCalled();
    expect(client.createPreviewDeployment).not.toHaveBeenCalled();
  });

  test("requires the literal project id for mutations", async () => {
    await expect(execute({ confirmation: "wrong-project" })).rejects.toThrow(
      /confirmação literal/i,
    );
  });

  test("configures three variables only for Preview", async () => {
    const client = createClient();
    const environment = stagingEnvironment();

    await execute({ client, environment, phase: "configure-preview" });

    expect(client.upsertProjectEnvironmentVariable).toHaveBeenCalledTimes(3);
    expect(client.upsertProjectEnvironmentVariable).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "SUPABASE_SECRET_KEY",
        type: "sensitive",
      }),
    );
    expect(JSON.stringify(client.mock.mock.calls)).not.toContain(
      environment.SUPABASE_SECRET_KEY,
    );
  });

  test("rejects projects with Git connected or production deployments", async () => {
    const linkedClient = createClient({
      project: { ...project, link: { repo: "espaco-personalize-pdv" } },
    });
    await expect(execute({ client: linkedClient })).rejects.toThrow(
      /Git.*proibida/i,
    );

    const productionClient = createClient({
      productionDeployments: { deployments: [{ uid: "dpl_prod" }] },
    });
    await expect(execute({ client: productionClient })).rejects.toThrow(
      /produção/i,
    );
  });

  test("deploys a Preview from the approved Git source", async () => {
    const client = createClient({
      deployment: {
        meta: { pr08: "true", roberto_environment: "staging" },
        name: manifest.vercel.projectName,
        readyState: "READY",
        target: null,
        uid: "dpl_preview123",
        url: "roberto-preview.vercel.app",
      },
    });

    const result = await execute({
      client,
      phase: "deploy-preview",
    });

    expect(client.createPreviewDeployment).toHaveBeenCalledWith({
      branch: "feature/provision-roberto-environments",
      orgId: manifest.vercel.orgId,
      projectId: manifest.vercel.projectId,
      projectName: manifest.vercel.projectName,
      repositoryId: 1264018806,
    });
    expect(client.deleteDeployment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      deploymentId: "dpl_preview123",
      deploymentUrl: "https://roberto-preview.vercel.app",
    });
  });

  test("removes a deployment if Vercel classifies it as Production", async () => {
    const client = createClient({ createdTarget: "production" });

    await expect(execute({ client, phase: "deploy-preview" })).rejects.toThrow(
      /classified.*Production/i,
    );

    expect(client.deleteDeployment).toHaveBeenCalledWith(
      "dpl_preview123",
      manifest.vercel.orgId,
    );
  });
});

function stagingEnvironment() {
  return {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-sentinel",
    NEXT_PUBLIC_SUPABASE_URL: "https://otsxpchqtfypxgzjzrxs.supabase.co",
    SUPABASE_SECRET_KEY: "service-secret-sentinel",
  };
}

function createClient({
  createdTarget = null,
  deployment = null,
  environmentVariables = {
    envs: [
      {
        key: "NEXT_PUBLIC_SUPABASE_URL",
        target: ["preview"],
        type: "encrypted",
      },
      {
        key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        target: ["preview"],
        type: "encrypted",
      },
      {
        key: "SUPABASE_SECRET_KEY",
        target: ["preview"],
        type: "sensitive",
      },
    ],
  },
  productionDeployments = { deployments: [] },
  project: projectOverride = project,
}: CreateClientOptions = {}) {
  const mock = vi.fn();
  return {
    createPreviewDeployment: vi.fn().mockResolvedValue({
      id: "dpl_preview123",
      target: createdTarget,
    }),
    deleteDeployment: vi.fn().mockResolvedValue(null),
    getDeployment: vi.fn().mockResolvedValue(deployment),
    getProject: vi.fn().mockResolvedValue(projectOverride),
    listProductionDeployments: vi.fn().mockResolvedValue(productionDeployments),
    listProjectEnvironmentVariables: vi
      .fn()
      .mockResolvedValue(environmentVariables),
    mock,
    upsertProjectEnvironmentVariable: vi
      .fn()
      .mockImplementation((value: { key: string; type: string }) => {
        mock({ key: value.key, type: value.type });
        return Promise.resolve({ created: true });
      }),
  };
}

type ExecuteOptions = {
  client?: ReturnType<typeof createClient>;
  confirmation?: string;
  environment?: ReturnType<typeof stagingEnvironment>;
  phase?: string;
};

function execute({
  client = createClient(),
  confirmation = manifest.vercel.projectId,
  environment = stagingEnvironment(),
  phase = "configure-preview",
}: ExecuteOptions = {}) {
  return runVercelProvisioning({
    args: ["--phase", phase, "--execute", "--confirm-project", confirmation],
    environment,
    log: vi.fn(),
    manifest,
    vercelClient: client,
    wait: vi.fn(),
  });
}
