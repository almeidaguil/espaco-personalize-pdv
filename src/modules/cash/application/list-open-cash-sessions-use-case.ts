import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type { CashSession } from "../domain/cash-session";
import type { CashSessionRepository } from "./cash-session-repository";

export type ListOpenCashSessionsUseCaseResult =
  | {
      sessions: CashSession[];
      success: true;
    }
  | {
      formError: string;
      success: false;
    };

type ListOpenCashSessionsUseCaseDependencies = {
  cashSessionRepository: CashSessionRepository;
  currentUserProfileRepository: CurrentUserProfileRepository;
};

export async function listOpenCashSessionsUseCase({
  cashSessionRepository,
  currentUserProfileRepository,
}: ListOpenCashSessionsUseCaseDependencies): Promise<ListOpenCashSessionsUseCaseResult> {
  const currentProfileResult = await currentUserProfileRepository.getCurrent();

  if (!currentProfileResult.success) {
    return {
      formError:
        currentProfileResult.error === "unauthenticated"
          ? "Sessao expirada. Entre novamente."
          : "Nao foi possivel identificar o usuario atual.",
      success: false,
    };
  }

  const result = await cashSessionRepository.listOpenByOperator(
    currentProfileResult.profile.id,
  );

  if (!result.success) {
    return {
      formError: "Nao foi possivel carregar os caixas abertos.",
      success: false,
    };
  }

  return {
    sessions: result.sessions,
    success: true,
  };
}
