import { readFile } from "node:fs/promises";

import { expect, test } from "vitest";

const sharedConcurrencyGroup =
  "local-supabase-${{ github.event.pull_request.number || github.ref }}";
const minimalSupabaseStart =
  "npx supabase start --exclude edge-runtime,imgproxy,logflare,mailpit,postgres-meta,realtime,storage-api,studio,supavisor,vector >/dev/null";

test("serializes database and E2E jobs that bind the local Supabase ports", async () => {
  const [qualityWorkflow, e2eWorkflow] = await Promise.all([
    readFile(".github/workflows/quality.yml", "utf8"),
    readFile(".github/workflows/e2e-release.yml", "utf8"),
  ]);

  expect(jobBlock(qualityWorkflow, "database")).toContain(
    `group: ${sharedConcurrencyGroup}`,
  );
  expect(jobBlock(qualityWorkflow, "database")).toContain(
    "cancel-in-progress: false",
  );
  expect(e2eWorkflow).toContain(`group: ${sharedConcurrencyGroup}`);
  expect(e2eWorkflow).toContain("cancel-in-progress: false");
});

test("starts only the Supabase services required by database and E2E gates", async () => {
  const [qualityWorkflow, e2eWorkflow] = await Promise.all([
    readFile(".github/workflows/quality.yml", "utf8"),
    readFile(".github/workflows/e2e-release.yml", "utf8"),
  ]);

  expect(jobBlock(qualityWorkflow, "database")).toContain(minimalSupabaseStart);
  expect(e2eWorkflow).toContain(minimalSupabaseStart);
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
