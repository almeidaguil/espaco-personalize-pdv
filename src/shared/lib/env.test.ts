import { describe, expect, it } from "vitest";

import { parsePublicEnv } from "./env";

describe("parsePublicEnv", () => {
  it("returns the validated public Supabase environment", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });

    expect(env).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });
  });

  it("rejects missing Supabase values", () => {
    expect(() => parsePublicEnv({})).toThrow();
  });

  it("rejects invalid Supabase URLs", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toThrow();
  });
});
