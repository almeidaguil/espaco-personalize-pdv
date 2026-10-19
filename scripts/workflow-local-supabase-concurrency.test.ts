import { readFile } from "node:fs/promises";

import { expect, test } from "vitest";

const sharedConcurrencyGroup =
  "local-supabase-${{ github.event.pull_request.number || github.ref }}";
const minimalSupabaseStart =
  "npx supabase start --exclude edge-runtime,imgproxy,logflare,mailpit,postgres-meta,realtime,storage-api,studio,supavisor,vector >/dev/null";
const requiredSupabaseImages = [
  [
    "supabase/postgres:17.6.1.132",
    "public.ecr.aws/supabase/postgres:17.6.1.132",
  ],
  ["supabase/gotrue:v2.189.0", "public.ecr.aws/supabase/gotrue:v2.189.0"],
  ["postgrest/postgrest:v14.12", "public.ecr.aws/supabase/postgrest:v14.12"],
  ["kong:2.8.1", "public.ecr.aws/supabase/kong:2.8.1"],
  ["supabase/realtime:v2.103.2", "public.ecr.aws/supabase/realtime:v2.103.2"],
  [
    "supabase/storage-api:v1.60.4",
    "public.ecr.aws/supabase/storage-api:v1.60.4",
  ],
  ["supabase/pg_prove:3.36", "public.ecr.aws/supabase/pg_prove:3.36"],
] as const;

test("runs database and E2E gates in one serialized Supabase job", async () => {
  const [qualityWorkflow, e2eWorkflow, packageJsonSource] = await Promise.all([
    readFile(".github/workflows/quality.yml", "utf8"),
    readFile(".github/workflows/e2e-release.yml", "utf8"),
    readFile("package.json", "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonSource) as {
    devDependencies?: Record<string, string>;
  };

  expect(e2eWorkflow).toContain(`group: ${sharedConcurrencyGroup}`);
  expect(e2eWorkflow).toContain("cancel-in-progress: false");
  expect(e2eWorkflow).toMatch(
    /  push:\r?\n    branches:\r?\n      - develop\r?\n      - main/,
  );
  expect(qualityWorkflow).not.toContain("supabase start");
  expect(packageJson.devDependencies?.supabase).toBe("2.105.0");

  const localGates = jobBlock(e2eWorkflow, "local-gates");
  for (const [source, target] of requiredSupabaseImages) {
    expect(localGates).toContain(`docker pull ${source}`);
    expect(localGates).toContain(`docker tag ${source} ${target}`);
  }
  expect(localGates).toContain(minimalSupabaseStart);
  expect(localGates).toContain("run: npm run test:db");
  expect(localGates).toContain("run: npm run test:e2e:local-reset");
  expect(
    `${qualityWorkflow}\n${e2eWorkflow}`.split(minimalSupabaseStart).length - 1,
  ).toBe(1);
});

test("preserves required database and Playwright check names", async () => {
  const e2eWorkflow = await readFile(
    ".github/workflows/e2e-release.yml",
    "utf8",
  );

  const databaseReporter = jobBlock(e2eWorkflow, "database");
  const e2eReporter = jobBlock(e2eWorkflow, "e2e");
  for (const reporter of [databaseReporter, e2eReporter]) {
    expect(reporter).toContain("needs: local-gates");
    expect(reporter).toContain("if: always()");
    expect(reporter).toContain(
      "LOCAL_GATES_RESULT: ${{ needs.local-gates.result }}",
    );
  }
  expect(databaseReporter).toContain("name: Database contract");
  expect(e2eReporter).toContain("name: Playwright E2E");
});

function jobBlock(workflow: string, jobName: string) {
  const match = workflow.match(
    new RegExp(
      `(?:^|\\r?\\n)  ${jobName}:\\r?\\n([\\s\\S]*?)(?=\\r?\\n  [a-z][a-z0-9_-]*:\\r?\\n|$)`,
    ),
  );
  if (!match) throw new Error(`Workflow job ${jobName} is missing.`);
  return match[0];
}
