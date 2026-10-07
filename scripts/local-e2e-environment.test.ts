// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildLocalE2EEnvironment,
  parseSupabaseEnvironment,
} from "./local-e2e-environment.mjs";
import { runLocalE2EGate } from "./run-local-e2e-gate.mjs";

const statusOutput = [
  'API_URL="http://127.0.0.1:54321"',
  "DB_URL='postgresql://postgres:private@127.0.0.1:54322/postgres'",
  'PUBLISHABLE_KEY="public-test-key"',
  'SECRET_KEY="secret-test-key=with-equals"',
].join("\r\n");
const status = {
  API_URL: "http://127.0.0.1:54321",
  DB_URL: "postgresql://postgres:private@127.0.0.1:54322/postgres",
  PUBLISHABLE_KEY: "public-test-key",
  SECRET_KEY: "secret-test-key=with-equals",
};
const credentialPrefixes = ["E2E_USER", "E2E_OPERATOR_A", "E2E_OPERATOR_B"];

describe("parseSupabaseEnvironment", () => {
  it("parses quoted status values without splitting embedded equals", () => {
    expect(
      parseSupabaseEnvironment(`ignored status message\n${statusOutput}\n`),
    ).toEqual(status);
  });
});

describe("buildLocalE2EEnvironment", () => {
  it.each([undefined, "", "http://127.0.0.1:4000"])(
    "pins helper URLs to the Next server and prevents env-file fallback",
    (inheritedUrl) => {
      const child = buildLocalE2EEnvironment(
        { E2E_BASE_URL: inheritedUrl },
        status,
      );
      expect(child.E2E_BASE_URL).toBe("http://localhost:3000");
    },
  );

  it("maps local CLI values and preserves unrelated child environment", () => {
    const parent = { PATH: "test-path", CI: "true" };
    const child = buildLocalE2EEnvironment(parent, status);
    expect(child).toMatchObject({
      PATH: "test-path",
      CI: "true",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
      SUPABASE_SECRET_KEY: "secret-test-key=with-equals",
      SUPABASE_TELEMETRY_DISABLED: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      E2E_LOCAL_RESET: "1",
    });
    expect(parent).toEqual({ PATH: "test-path", CI: "true" });
  });

  it("generates three distinct strong credentials anew for every gate run", () => {
    const child = buildLocalE2EEnvironment({}, status);
    const another = buildLocalE2EEnvironment({}, status);
    const emails = credentialPrefixes.map((prefix) => child[`${prefix}_EMAIL`]);
    const passwords = credentialPrefixes.map(
      (prefix) => child[`${prefix}_PASSWORD`],
    );
    expect(new Set(emails).size).toBe(3);
    expect(new Set(passwords).size).toBe(3);
    for (const prefix of credentialPrefixes) {
      expect(child[`${prefix}_EMAIL`]).toMatch(/@example\.test$/);
      expect(child[`${prefix}_PASSWORD`]).toMatch(/^[a-f0-9]{64}$/);
      expect(child[`${prefix}_PASSWORD`]).not.toBe(
        another[`${prefix}_PASSWORD`],
      );
      expect(child[`${prefix}_EMAIL`]).not.toBe(another[`${prefix}_EMAIL`]);
    }
  });

  it.each(["API_URL", "PUBLISHABLE_KEY", "SECRET_KEY"])(
    "fails with variable names only when %s is absent",
    (variable) => {
      expect(() =>
        buildLocalE2EEnvironment({}, { ...status, [variable]: "" }),
      ).toThrow(variable);
    },
  );

  it.each([
    { API_URL: "https://private-target.supabase.co" },
    { DB_URL: "postgresql://private:password@remote.test/db" },
    { API_URL: "http://127.0.0.2:54321" },
    { DB_URL: "malformed-private-url" },
  ])(
    "rejects remote or invalid CLI endpoints without exposing values",
    (bad) => {
      let message = "";
      try {
        buildLocalE2EEnvironment({}, { ...status, ...bad });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/local|invalid/i);
      for (const value of Object.values(bad))
        expect(message).not.toContain(value);
      expect(message).not.toContain(status.SECRET_KEY);
    },
  );
});

describe("runLocalE2EGate", () => {
  function harness(exitCodes = [0, 0, 0, 0]) {
    const commands: {
      command: string;
      args: string[];
      options: {
        env: Record<string, string | undefined>;
        stdio?: string;
      };
    }[] = [];
    const logs: string[] = [];
    const execute = (
      command: string,
      args: string[],
      options: (typeof commands)[number]["options"],
    ) => {
      commands.push({ command, args, options });
      return {
        status: exitCodes[commands.length - 1],
        stdout: commands.length === 1 ? statusOutput : "Local step completed.",
        stderr: commands.length === 1 ? "SECRET_KEY=private-stderr-value" : "",
      };
    };
    return { commands, logs, execute, log: (line: string) => logs.push(line) };
  }

  it("resets only local state, then seeds and runs required E2E with one child environment", () => {
    const fake = harness();
    expect(runLocalE2EGate({ environment: {}, args: [], ...fake })).toBe(0);
    expect(fake.commands.map(({ args }) => args)).toEqual([
      ["supabase", "status", "-o", "env"],
      ["supabase", "db", "reset", "--local", "--yes"],
      ["run", "e2e:seed-local"],
      ["run", "test:e2e:required"],
    ]);
    const child = fake.commands[1].options.env;
    for (const command of fake.commands.slice(1)) {
      expect(command.options.env).toBe(child);
      expect(command.options.stdio).toBe("pipe");
    }
    expect(child.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(child.SUPABASE_SECRET_KEY).toBe(status.SECRET_KEY);
    expect(fake.commands[0].options.stdio).not.toBe("inherit");
    const logs = fake.logs.join("\n");
    expect(logs).toContain("127.0.0.1");
    for (const prefix of credentialPrefixes) {
      expect(logs).not.toContain(child[`${prefix}_EMAIL`]);
      expect(logs).not.toContain(child[`${prefix}_PASSWORD`]);
    }
    expect(logs).not.toContain(status.PUBLISHABLE_KEY);
    expect(logs).not.toContain(status.SECRET_KEY);
    expect(logs).not.toContain(statusOutput);
    expect(logs).not.toContain("private-stderr-value");
  });

  it.each(["stdout", "stderr"])(
    "redacts failure credentials from %s while preserving diagnostics and exit code",
    (stream) => {
      const fake = harness([0, 0, 0, 37]);
      const environment = {
        CI_DEPLOY_TOKEN: "inherited-deploy-token",
        AUTHORIZATION: "Bearer inherited-authorization",
        DATABASE_URL:
          "postgresql://postgres:inherited-db-password@localhost/db",
        CUSTOM_CREDENTIAL: "inherited-credential",
        EXTRA_API_KEY: "extra-api-key",
      };
      let sensitiveValues: string[] = [];
      const execute = (...args: Parameters<typeof fake.execute>) => {
        const result = fake.execute(...args);
        if (args[1][1] !== "test:e2e:required") return result;
        const child = args[2].env;
        sensitiveValues = [
          ...credentialPrefixes.flatMap((prefix) => [
            child[`${prefix}_EMAIL`]!,
            child[`${prefix}_PASSWORD`]!,
          ]),
          child.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          child.SUPABASE_SECRET_KEY!,
          ...Object.values(environment),
          "inherited-db-password",
        ];
        return {
          ...result,
          [stream]: [
            "Timeout 1000ms exceeded.",
            `locator.fill(${child.E2E_USER_PASSWORD})`,
            ...sensitiveValues.map((value) => `credential=${value}`),
            "1 failed: authentication.spec.ts",
          ].join("\n"),
        };
      };
      expect(runLocalE2EGate({ environment, args: [], ...fake, execute })).toBe(
        37,
      );
      const output = fake.logs.join("\n");
      expect(output).toContain("Timeout 1000ms exceeded.");
      expect(output).toContain("1 failed: authentication.spec.ts");
      expect(output).toContain("locator.fill([REDACTED])");
      for (const value of sensitiveValues) expect(output).not.toContain(value);
      expect(fake.commands).toHaveLength(4);
    },
  );

  it.each(["--linked", "--db-url", "--local", "https://remote.test"])(
    "rejects argument %s before any child command",
    (argument) => {
      const fake = harness();
      expect(
        runLocalE2EGate({ environment: {}, args: [argument], ...fake }),
      ).toBe(1);
      expect(fake.commands).toHaveLength(0);
      expect(fake.logs.join("\n")).not.toContain(argument);
    },
  );

  it.each([
    { NEXT_PUBLIC_SUPABASE_URL: "https://private.supabase.co" },
    { E2E_BASE_URL: "https://private-app.test" },
    { DATABASE_TEST_SUPABASE_URL: "https://private.supabase.co" },
    { DB_URL: "postgresql://private:password@remote.test/db" },
    { E2E_EXPECTED_SUPABASE_PROJECT_REF: "private-project-ref" },
  ])(
    "rejects inherited remote targets before status or reset",
    (environment) => {
      const fake = harness();
      expect(runLocalE2EGate({ environment, args: [], ...fake })).toBe(1);
      expect(fake.commands).toHaveLength(0);
      for (const value of Object.values(environment))
        expect(fake.logs.join("\n")).not.toContain(value);
    },
  );

  it("rejects remote status before reset even with no inherited target", () => {
    const fake = harness();
    const execute = (...args: Parameters<typeof fake.execute>) => ({
      ...fake.execute(...args),
      stdout: statusOutput.replace("127.0.0.1", "remote.test"),
    });
    expect(
      runLocalE2EGate({ environment: {}, args: [], ...fake, execute }),
    ).toBe(1);
    expect(fake.commands).toHaveLength(1);
    expect(fake.logs.join("\n")).not.toContain("remote.test");
  });

  it.each([
    { codes: [17], count: 1, expected: 17 },
    { codes: [0, 23], count: 2, expected: 23 },
    { codes: [0, 0, 29], count: 3, expected: 29 },
    { codes: [0, 0, 0, 31], count: 4, expected: 31 },
    { codes: [0, 0, 0, null], count: 4, expected: 1 },
  ])(
    "stops at first child failure and preserves its code",
    ({ codes, count, expected }) => {
      const fake = harness(codes as number[]);
      expect(runLocalE2EGate({ environment: {}, args: [], ...fake })).toBe(
        expected,
      );
      expect(fake.commands).toHaveLength(count);
      expect(fake.logs.join("\n")).not.toContain(status.SECRET_KEY);
      expect(fake.logs.join("\n")).not.toContain("private-stderr-value");
    },
  );
});
