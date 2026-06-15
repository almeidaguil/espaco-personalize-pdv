import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import { closeCashSession, type CashSession } from "../domain/cash-session";
import type { CashSessionRepository } from "./cash-session-repository";
import { closeCashSessionSchema } from "./cash-session-validation";
import type { CashSessionDateProvider } from "./open-cash-session-use-case";

export type CloseCashSessionUseCaseResult =
  | {
      session: CashSession;
      success: true;
    }
  | {
      fieldErrors?: Partial<
        Record<"cashSessionId" | "countedAmountInReais", string>
      >;
      formError?: string;
      success: false;
    };

type CloseCashSessionUseCaseDependencies = {
  cashSessionRepository: CashSessionRepository;
  currentUserProfileRepository: CurrentUserProfileRepository;
  getCurrentDate: CashSessionDateProvider;
};

export async function closeCashSessionUseCase(
  input: unknown,
  dependencies: CloseCashSessionUseCaseDependencies,
): Promise<CloseCashSessionUseCaseResult> {
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

  const parsedInput = closeCashSessionSchema.safeParse(input);

  if (!parsedInput.success) {
    const flattenedErrors = parsedInput.error.flatten().fieldErrors;

    return {
      fieldErrors: {
        cashSessionId: flattenedErrors.cashSessionId?.[0],
        countedAmountInReais: flattenedErrors.countedAmountInReais?.[0],
      },
      success: false,
    };
  }

  const openSessionResult =
    await dependencies.cashSessionRepository.findOpenByIdAndOperator({
      cashSessionId: parsedInput.data.cashSessionId,
      operatorId: currentProfileResult.profile.id,
    });

  if (!openSessionResult.success) {
    return {
      formError: "Nao foi possivel verificar o caixa aberto.",
      success: false,
    };
  }

  if (!openSessionResult.session) {
    return {
      formError: "Nao ha caixa aberto para fechar.",
      success: false,
    };
  }

  const closeResult = closeCashSession({
    closedAt: dependencies.getCurrentDate(),
    countedAmountInReais: parsedInput.data.countedAmountInReais,
    session: openSessionResult.session,
  });

  if (!closeResult.success) {
    return {
      formError: closeResult.errors[0]?.message ?? "Caixa invalido.",
      success: false,
    };
  }

  const updateResult = await dependencies.cashSessionRepository.update(
    closeResult.session,
  );

  if (!updateResult.success) {
    return {
      formError: "Nao foi possivel fechar o caixa.",
      success: false,
    };
  }

  return {
    session: updateResult.session,
    success: true,
  };
}
