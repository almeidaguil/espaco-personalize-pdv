import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "./current-user-profile-repository";
import { requireAdminUseCase } from "./require-admin-use-case";

describe("requireAdminUseCase", () => {
  it("allows admin users", async () => {
    await expect(
      requireAdminUseCase(createRepository({ role: "admin" })),
    ).resolves.toEqual({
      success: true,
    });
  });

  it("blocks operator users", async () => {
    await expect(
      requireAdminUseCase(createRepository({ role: "operator" })),
    ).resolves.toEqual({
      formError: "Acesso restrito a administradores.",
      success: false,
    });
  });

  it("maps unauthenticated users to a session error", async () => {
    await expect(
      requireAdminUseCase({
        getCurrent: async () => ({
          error: "unauthenticated",
          success: false,
        }),
      }),
    ).resolves.toEqual({
      formError: "Sessao expirada. Faca login novamente.",
      success: false,
    });
  });
});

function createRepository(input: {
  role: "admin" | "operator";
}): CurrentUserProfileRepository {
  return {
    getCurrent: async () => ({
      profile: {
        id: "user-1",
        role: input.role,
      },
      success: true,
    }),
  };
}
