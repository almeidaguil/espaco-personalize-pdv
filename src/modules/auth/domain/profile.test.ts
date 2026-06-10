import { describe, expect, it } from "vitest";

import { isUserRole, userRoles } from "./profile";

describe("profile domain", () => {
  it("defines the supported user roles", () => {
    expect(userRoles).toEqual(["admin", "operator"]);
  });

  it("accepts only supported roles", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("operator")).toBe(true);
    expect(isUserRole("owner")).toBe(false);
  });
});
