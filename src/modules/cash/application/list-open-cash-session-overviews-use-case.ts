import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type {
  OpenCashSessionOverview,
  OpenCashSessionOverviewRepository,
} from "./open-cash-session-overview-repository";

export type ListOpenCashSessionOverviewsUseCaseResult =
  | {
      overviews: OpenCashSessionOverview[];
      success: true;
    }
  | {
      formError: string;
      success: false;
    };

type ListOpenCashSessionOverviewsUseCaseDependencies = {
  currentUserProfileRepository: CurrentUserProfileRepository;
  openCashSessionOverviewRepository: OpenCashSessionOverviewRepository;
};

export async function listOpenCashSessionOverviewsUseCase({
  currentUserProfileRepository,
  openCashSessionOverviewRepository,
}: ListOpenCashSessionOverviewsUseCaseDependencies): Promise<ListOpenCashSessionOverviewsUseCaseResult> {
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

  const result = await openCashSessionOverviewRepository.listOpen();

  if (!result.success) {
    return {
      formError: "Nao foi possivel carregar os caixas abertos.",
      success: false,
    };
  }

  return {
    overviews:
      currentProfileResult.profile.role === "admin"
        ? result.overviews
        : result.overviews.filter(
            (overview) =>
              overview.operatorId === currentProfileResult.profile.id,
          ),
    success: true,
  };
}
