import { describe, expect, it } from "vitest";

import { assertLocalSupabaseUrl, resolveE2EUsers } from "./e2e-test-users.mjs";

const environment = {
  E2E_USER_EMAIL: "admin@example.test",
  E2E_USER_PASSWORD: "admin-test-secret",
  E2E_OPERATOR_A_EMAIL: "operator-a@example.test",
  E2E_OPERATOR_A_PASSWORD: "operator-a-test-secret",
  E2E_OPERATOR_B_EMAIL: "operator-b@example.test",
  E2E_OPERATOR_B_PASSWORD: "operator-b-test-secret",
};

describe("resolveE2EUsers", () => {
  it("preserves the admin and resolves two separate operator identities", () => {
    expect(resolveE2EUsers(environment)).toEqual([
      {
        name: "admin",
        email: "admin@example.test",
        password: "admin-test-secret",
        fullName: "E2E Admin",
        role: "admin",
      },
      {
        name: "operatorA",
        email: "operator-a@example.test",
        password: "operator-a-test-secret",
        fullName: "E2E Operator A",
        role: "operator",
      },
      {
        name: "operatorB",
        email: "operator-b@example.test",
        password: "operator-b-test-secret",
        fullName: "E2E Operator B",
        role: "operator",
      },
    ]);
  });

  it("reports every missing credential variable in stable order", () => {
    expect(() => resolveE2EUsers({})).toThrow(
      "Missing required E2E environment variables: E2E_USER_EMAIL, E2E_USER_PASSWORD, E2E_OPERATOR_A_EMAIL, E2E_OPERATOR_A_PASSWORD, E2E_OPERATOR_B_EMAIL, E2E_OPERATOR_B_PASSWORD",
    );
  });

  it("reports only missing names and never includes supplied secrets", () => {
    const partial = {
      ...environment,
      E2E_OPERATOR_A_PASSWORD: "  ",
      E2E_OPERATOR_B_EMAIL: undefined,
    };
    let message = "";
    try {
      resolveE2EUsers(partial);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe(
      "Missing required E2E environment variables: E2E_OPERATOR_A_PASSWORD, E2E_OPERATOR_B_EMAIL",
    );
    for (const value of Object.values(environment))
      expect(message).not.toContain(value);
  });

  it("rejects overlapping emails so identities cannot overwrite each other", () => {
    expect(() =>
      resolveE2EUsers({
        ...environment,
        E2E_OPERATOR_A_EMAIL: "ADMIN@example.test",
      }),
    ).toThrow(
      "E2E_USER_EMAIL, E2E_OPERATOR_A_EMAIL, E2E_OPERATOR_B_EMAIL must identify distinct users.",
    );
  });
});

describe("assertLocalSupabaseUrl", () => {
  it.each([
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
    "https://localhost:54321",
  ])("accepts local endpoint %s", (value) => {
    expect(() => assertLocalSupabaseUrl(value)).not.toThrow();
  });

  it.each([
    "https://remote.supabase.co",
    "http://localhost.example.test",
    "http://127.0.0.2:54321",
    "http://[::2]:54321",
    "ftp://localhost:54321",
    "http://secret:password@localhost:54321",
    "invalid-private-value",
    "",
  ])(
    "rejects unsafe or invalid endpoints without leaking their value",
    (value) => {
      let message = "";
      try {
        assertLocalSupabaseUrl(value);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
      if (value) expect(message).not.toContain(value);
      expect(message).not.toContain("password");
    },
  );
});
