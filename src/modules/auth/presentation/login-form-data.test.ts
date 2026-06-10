import { describe, expect, it } from "vitest";

import { parseLoginFormData } from "./login-form-data";

describe("parseLoginFormData", () => {
  it("normalizes login form entries as trimmed strings", () => {
    const formData = new FormData();
    formData.set("email", " operador@example.com ");
    formData.set("password", " secret123 ");

    expect(parseLoginFormData(formData)).toEqual({
      email: "operador@example.com",
      password: "secret123",
    });
  });

  it("uses empty strings for missing or non-string entries", () => {
    const formData = new FormData();
    formData.set("email", new File(["content"], "email.txt"));

    expect(parseLoginFormData(formData)).toEqual({
      email: "",
      password: "",
    });
  });
});
