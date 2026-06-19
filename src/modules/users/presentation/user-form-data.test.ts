import { describe, expect, it } from "vitest";

import {
  parseCreateUserFormData,
  parseResetUserPasswordFormData,
  parseSetUserAccessFormData,
  parseUpdateUserRoleFormData,
} from "./user-form-data";

describe("user form data", () => {
  it("parses create user data", () => {
    const formData = new FormData();
    formData.set("email", " operador@example.com ");
    formData.set("fullName", " Operador Teste ");
    formData.set("temporaryPassword", "temporary123");

    expect(parseCreateUserFormData(formData)).toMatchObject({
      data: {
        email: "operador@example.com",
        fullName: "Operador Teste",
        temporaryPassword: "temporary123",
      },
      success: true,
    });
  });

  it("rejects invalid create user data", () => {
    const formData = new FormData();
    formData.set("email", "invalid");
    formData.set("fullName", "A");
    formData.set("temporaryPassword", "123");

    expect(parseCreateUserFormData(formData).success).toBe(false);
  });

  it("parses role changes", () => {
    const formData = new FormData();
    formData.set("role", "admin");
    formData.set("userId", "38dc5fe9-feae-4083-9736-46a253727e2a");

    expect(parseUpdateUserRoleFormData(formData)).toMatchObject({
      data: {
        role: "admin",
        userId: "38dc5fe9-feae-4083-9736-46a253727e2a",
      },
      success: true,
    });
  });

  it("parses access changes", () => {
    const formData = new FormData();
    formData.set("isActive", "false");
    formData.set("userId", "38dc5fe9-feae-4083-9736-46a253727e2a");

    expect(parseSetUserAccessFormData(formData)).toMatchObject({
      data: {
        isActive: false,
        userId: "38dc5fe9-feae-4083-9736-46a253727e2a",
      },
      success: true,
    });
  });

  it("parses password resets", () => {
    const formData = new FormData();
    formData.set("temporaryPassword", "temporary123");
    formData.set("userId", "38dc5fe9-feae-4083-9736-46a253727e2a");

    expect(parseResetUserPasswordFormData(formData)).toMatchObject({
      data: {
        temporaryPassword: "temporary123",
        userId: "38dc5fe9-feae-4083-9736-46a253727e2a",
      },
      success: true,
    });
  });

  it("rejects invalid password resets", () => {
    const formData = new FormData();
    formData.set("temporaryPassword", "123");
    formData.set("userId", "invalid");

    expect(parseResetUserPasswordFormData(formData).success).toBe(false);
  });
});
