import type { AuthRepository } from "./auth-repository";
import { loginSchema } from "./login-validation";

export type AuthenticateWithPasswordResult =
  | {
      success: true;
    }
  | {
      fieldErrors?: Partial<Record<"email" | "password", string>>;
      formError?: string;
      success: false;
    };

export async function authenticateWithPasswordUseCase(
  input: unknown,
  authRepository: AuthRepository,
): Promise<AuthenticateWithPasswordResult> {
  const parsedInput = loginSchema.safeParse(input);

  if (!parsedInput.success) {
    const flattenedErrors = parsedInput.error.flatten().fieldErrors;

    return {
      fieldErrors: {
        email: flattenedErrors.email?.[0],
        password: flattenedErrors.password?.[0],
      },
      success: false,
    };
  }

  const result = await authRepository.signInWithPassword(parsedInput.data);

  if (!result.success) {
    return {
      formError: result.error,
      success: false,
    };
  }

  return {
    success: true,
  };
}
