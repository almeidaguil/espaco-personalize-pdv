import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const forbiddenPaths = [
  "src/app/events",
  "src/modules/events",
  "tests/e2e/event-create.spec.ts",
  "tests/e2e/global-setup.ts",
];
const activeDocuments = [
  "README.md",
  "AGENTS.md",
  "docs/manual-usuario-final.md",
  "docs/runbook-operacional.md",
  "docs/checklist-go-live.md",
  "docs/e2e-release-gate.md",
  "docs/observabilidade.md",
  "public/manifest.webmanifest",
];
// These files prove removal from the historical schema or define this gate.
const scanExceptions = new Set([
  "scripts/test-remove-events-upgrade.mjs",
  "supabase/tests/database/002_remove_events_legacy.test.sql",
  "scripts/verify-no-event-legacy.mjs",
]);
const legacyRouteTest = "tests/e2e/legacy-event-routes.spec.ts";
const domainPatterns = [
  { name: "event_id", expression: /\bevent_id\b/g },
  { name: "/events", expression: /\/events\b[^"'`\s)<>]*/g },
  {
    name: '.from("events")',
    expression: /\.from\s*\(\s*(["'`])events\1\s*\)/g,
  },
];
const documentationPatterns = [
  ...domainPatterns,
  { name: "evento(s)", expression: /\beventos?\b/gi },
  { name: "Espaco Personalize", expression: /espa[cç]o\s+personalize/gi },
];
const findings = [];

for (const path of forbiddenPaths) {
  if (existsSync(path)) findings.push(`${path}: forbidden legacy path`);
}

for (const root of [
  "src",
  "public",
  "scripts",
  "tests/e2e",
  "supabase/tests",
]) {
  for (const path of listFiles(root)) {
    if (scanExceptions.has(path)) continue;
    if (!/\.(?:[cm]?js|jsx|tsx?|sql|json|webmanifest|html|css)$/.test(path))
      continue;
    scanFile(path, domainPatterns);
  }
}
for (const path of activeDocuments) scanFile(path, documentationPatterns);

if (findings.length > 0) {
  console.error("FAIL: active event legacy dependencies found:");
  for (const finding of new Set(findings)) console.error(`- ${finding}`);
  process.exit(1);
}
console.log("PASS: no active event legacy dependencies.");

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function scanFile(path, patterns) {
  const source = readFileSync(join(process.cwd(), path), "utf8");
  for (const { name, expression } of patterns) {
    for (const match of source.matchAll(expression)) {
      if (
        path === legacyRouteTest &&
        name === "/events" &&
        is404RouteLiteral(source, match)
      ) {
        continue;
      }
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${path}:${line}: ${name}`);
    }
  }
}

function is404RouteLiteral(source, match) {
  const quote = source[match.index - 1];
  return (
    ["/events", "/events/new"].includes(match[0]) &&
    ["'", '"', "`"].includes(quote) &&
    source[match.index + match[0].length] === quote
  );
}
