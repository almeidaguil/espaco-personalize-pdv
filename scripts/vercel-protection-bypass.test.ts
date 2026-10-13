import { describe, expect, test } from "vitest";

import { hasActiveVercelProtectionBypass } from "./vercel-protection-bypass.mjs";

describe("hasActiveVercelProtectionBypass", () => {
  test.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty plain object", {}],
    ["Vercel's exact empty sentinel", { "": null }],
  ])("treats %s as no active bypass", (_name, protectionBypass) => {
    expect(hasActiveVercelProtectionBypass(protectionBypass)).toBe(false);
  });

  test.each([
    ["an empty array", []],
    ["an empty string", ""],
    ["false", false],
    ["zero", 0],
    ["an object without a prototype", Object.create(null)],
    ["an object with an unexpected prototype", Object.create({})],
    ["a real bypass", { "automation-secret-sentinel": null }],
    ["the empty sentinel plus a real bypass", { "": null, real: null }],
    ["a malformed empty sentinel", { "": {} }],
  ])("fails closed for %s", (_name, protectionBypass) => {
    expect(hasActiveVercelProtectionBypass(protectionBypass)).toBe(true);
  });
});
