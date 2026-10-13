import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  assertLocalE2ETargets,
  buildLocalE2EEnvironment,
  parseSupabaseEnvironment,
} from "./local-e2e-environment.mjs";

/**
 * @param {{
 *   environment?: Record<string, string | undefined>,
 *   args?: string[],
 *   execute?: (command: string, args: string[], options: {
 *     cwd: string, env: Record<string, string | undefined>, shell: boolean,
 *     encoding?: "utf8", stdio?: "pipe", maxBuffer?: number
 *   }) => { status: number | null, stdout?: string | null, stderr?: string | null },
 *   log?: (message: string) => void
 * }} options
 */
export function runLocalE2EGate({
  environment = process.env,
  args = process.argv.slice(2),
  execute = spawnSync,
  log = console.log,
} = {}) {
  try {
    assertLocalE2ETargets(environment, args);
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const status = execute(npx, ["supabase", "status", "-o", "env"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...environment, SUPABASE_TELEMETRY_DISABLED: "1" },
      shell: process.platform === "win32",
    });
    // CLI stdout/stderr may contain keys, including on failure. Never log them.
    if (status.status !== 0) {
      log("The local Supabase stack is not available.");
      return status.status ?? 1;
    }
    const localStatus = parseSupabaseEnvironment(status.stdout ?? "");
    const child = buildLocalE2EEnvironment(environment, localStatus);
    const redact = createOutputRedactor({ ...localStatus, ...child });
    log(
      `E2E gate local hostname: ${new URL(child.NEXT_PUBLIC_SUPABASE_URL).hostname}`,
    );
    const steps = [
      {
        name: "Local database reset",
        command: npx,
        args: ["supabase", "db", "reset", "--local", "--yes"],
      },
      { name: "Local E2E seed", command: npm, args: ["run", "e2e:seed-local"] },
      {
        name: "Required Playwright suite",
        command: npm,
        args: ["run", "test:e2e:required"],
      },
    ];
    for (const step of steps) {
      // Recheck the local targets immediately before the destructive step.
      assertLocalE2ETargets(child);
      log(`E2E gate: ${step.name}.`);
      const result = execute(step.command, step.args, {
        cwd: process.cwd(),
        env: child,
        shell: process.platform === "win32",
        encoding: "utf8",
        stdio: "pipe",
        maxBuffer: 16 * 1024 * 1024,
      });
      for (const output of [result.stdout, result.stderr]) {
        if (output) log(redact(output));
      }
      if (result.status !== 0) return result.status ?? 1;
    }
    log("Local E2E gate completed successfully.");
    return 0;
  } catch {
    log(
      "Local E2E gate refused an invalid configuration or could not run a command.",
    );
    return 1;
  }
}

/** @param {Record<string, string | undefined>} environment */
function createOutputRedactor(environment) {
  const sensitiveValues = new Set();
  for (const [name, value] of Object.entries(environment)) {
    if (!value) continue;
    if (
      /PASSWORD|PASSWD|(?:^|_)PASS$|SECRET|TOKEN|KEY|EMAIL|AUTH|CREDENTIAL|COOKIE/i.test(
        name,
      )
    ) {
      sensitiveValues.add(value);
    }
    // Connection URLs may embed credentials without a sensitive variable name.
    try {
      const url = new URL(value);
      if (url.password) {
        sensitiveValues.add(value);
        sensitiveValues.add(url.password);
        sensitiveValues.add(decodeURIComponent(url.password));
      }
    } catch {
      // Ordinary environment strings are not URLs.
    }
  }
  const variants = [...sensitiveValues].flatMap((value) => [
    value,
    JSON.stringify(value).slice(1, -1),
    encodeURIComponent(value),
  ]);
  const replacements = [...new Set(variants)].sort(
    (a, b) => b.length - a.length,
  );
  /** @param {string} output */
  return (output) => {
    for (const value of replacements) {
      output = output.replaceAll(value, "[REDACTED]");
    }
    return output;
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = runLocalE2EGate();
}
