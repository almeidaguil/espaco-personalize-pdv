import { describe, expect, it, vi } from "vitest";

import type { AuthRepository } from "./auth-repository";
import { authenticateWithPasswordUseCase } from "./authenticate-with-password-use-case";

describe("authenticateWithPasswordUseCase", () => {
  it("rejects invalid credentials before calling the repository", async () => {
    const authRepository = {
      signInWithPassword: vi.fn(),
    } satisfies AuthRepository;

    const result = await authenticateWithPasswordUseCase(
      {
        email: "invalid-email",
        password: "",
      },
      authRepository,
    );

    expect(result).toEqual({
      fieldErrors: {
        email: "Informe um e-mail valido.",
        password: "Informe a senha.",
      },
      success: false,
    });
    expect(authRepository.signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns a form error when the repository rejects authentication", async () => {
    const authRepository = {
      signInWithPassword: vi.fn().mockResolvedValue({
        error: "Credenciais invalidas.",
        success: false,
      }),
    } satisfies AuthRepository;

    const result = await authenticateWithPasswordUseCase(
      {
        email: "operator@example.com",
        password: "secret123",
      },
      authRepository,
    );

    expect(result).toEqual({
      formError: "Credenciais invalidas.",
      success: false,
    });
  });

  it("authenticates valid credentials through the repository", async () => {
    const authRepository = {
      signInWithPassword: vi.fn().mockResolvedValue({
        session: {
          email: "operator@example.com",
          userId: "user-id",
        },
        success: true,
      }),
    } satisfies AuthRepository;

    const result = await authenticateWithPasswordUseCase(
      {
        email: "operator@example.com",
        password: "secret123",
      },
      authRepository,
    );

    expect(result).toEqual({
      success: true,
    });
    expect(authRepository.signInWithPassword).toHaveBeenCalledWith({
      email: "operator@example.com",
      password: "secret123",
    });
  });
});
