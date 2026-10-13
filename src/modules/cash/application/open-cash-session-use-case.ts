import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type { CashSession } from "../domain/cash-session";
import type { CashSessionRepository } from "./cash-session-repository";
import { openCashSessionSchema } from "./cash-session-validation";

export type OpenCashSessionUseCaseResult =
  | {
      session: CashSession;
      success: true;
    }
  | {
      fieldErrors?: Partial<Record<"openingAmountInReais", string>>;
      formError?: string;
      success: false;
    };

type OpenCashSessionUseCaseDependencies = {
  cashSessionRepository: CashSessionRepository;
  currentUserProfileRepository: CurrentUserProfileRepository;
};

export async function openCashSessionUseCase(
  input: unknown,
  dependencies: OpenCashSessionUseCaseDependencies,
): Promise<OpenCashSessionUseCaseResult> {
  const parsedInput = openCashSessionSchema.safeParse(input);

  if (!parsedInput.success) {
    const flattenedErrors = parsedInput.error.flatten().fieldErrors;

    return {
      fieldErrors: {
        openingAmountInReais: flattenedErrors.openingAmountInReais?.[0],
      },
      success: false,
    };
  }

  const currentProfileResult =
    await dependencies.currentUserProfileRepository.getCurrent();

  if (!currentProfileResult.success) {
    return {
      formError:
        currentProfileResult.error === "unauthenticated"
          ? "Sessao expirada. Entre novamente."
          : "Nao foi possivel identificar o usuario atual.",
      success: false,
    };
  }

  const existingOpenSessionResult =
    await dependencies.cashSessionRepository.findOpenByOperator(
      currentProfileResult.profile.id,
    );

  if (!existingOpenSessionResult.success) {
    return {
      formError: "Nao foi possivel verificar o caixa aberto.",
      success: false,
    };
  }

  if (existingOpenSessionResult.session) {
    return {
      formError: "Ja existe um caixa aberto para este operador.",
      success: false,
    };
  }

  const saveResult = await dependencies.cashSessionRepository.open({
    openingAmountInReais: parsedInput.data.openingAmountInReais,
  });

  if (!saveResult.success) {
    return {
      formError:
        saveResult.error === "open_session_already_exists"
          ? "Ja existe um caixa aberto para este operador."
          : "Nao foi possivel abrir o caixa.",
      success: false,
    };
  }

  return {
    session: saveResult.session,
    success: true,
  };
}
