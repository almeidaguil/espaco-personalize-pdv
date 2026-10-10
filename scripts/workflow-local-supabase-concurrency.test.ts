import { readFile } from "node:fs/promises";

import { expect, test } from "vitest";

const sharedConcurrencyGroup =
  "local-supabase-${{ github.event.pull_request.number || github.ref }}";

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

function jobBlock(workflow: string, jobName: string) {
  const match = workflow.match(
    new RegExp(
      `(?:^|\\r?\\n)  ${jobName}:\\r?\\n([\\s\\S]*?)(?=\\r?\\n  [a-z][a-z0-9_-]*:\\r?\\n|$)`,
    ),
  );
  if (!match) throw new Error(`Workflow job ${jobName} is missing.`);
  return match[0];
}
