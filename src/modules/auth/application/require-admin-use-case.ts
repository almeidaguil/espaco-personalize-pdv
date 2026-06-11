import type { CurrentUserProfileRepository } from "./current-user-profile-repository";

export type RequireAdminUseCaseResult =
  | {
      success: true;
    }
  | {
      formError: string;
      success: false;
    };

export async function requireAdminUseCase(
  currentUserProfileRepository: CurrentUserProfileRepository,
): Promise<RequireAdminUseCaseResult> {
  const currentUserResult = await currentUserProfileRepository.getCurrent();

  if (!currentUserResult.success) {
    return {
      formError:
        currentUserResult.error === "unauthenticated"
          ? "Sessao expirada. Faca login novamente."
          : "Nao foi possivel verificar sua permissao.",
      success: false,
    };
  }

  if (currentUserResult.profile.role !== "admin") {
    return {
      formError: "Acesso restrito a administradores.",
      success: false,
    };
  }

  return {
    success: true,
  };
}
