import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type { CashSession } from "../domain/cash-session";
import type { CashSessionRepository } from "./cash-session-repository";
import type { CashSessionDateProvider } from "./cash-session-date-provider";
import { closeCashSessionSchema } from "./cash-session-validation";

export type CloseCashSessionUseCaseResult =
  | {
      session: CashSession;
      success: true;
    }
  | {
      fieldErrors?: Partial<
        Record<"cashSessionId" | "reconciliations", string>
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
        reconciliations: flattenedErrors.reconciliations?.[0],
      },
      success: false,
    };
  }

  const openSessionResult =
    await dependencies.cashSessionRepository.findOpenById(
      parsedInput.data.cashSessionId,
    );

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

  const isSessionOperator =
    openSessionResult.session.operatorId === currentProfileResult.profile.id;

  if (!isSessionOperator && currentProfileResult.profile.role !== "admin") {
    return {
      formError: "Voce nao tem permissao para fechar este caixa.",
      success: false,
    };
  }

  const closeResult = await dependencies.cashSessionRepository.close({
    ...(parsedInput.data.adminPassword
      ? { adminPassword: parsedInput.data.adminPassword }
      : {}),
    cashSessionId: parsedInput.data.cashSessionId,
    reconciliations: parsedInput.data.reconciliations,
  });

  if (!closeResult.success) {
    return {
      formError:
        closeResult.error === "admin_password_required"
          ? "Informe uma senha administrativa valida para fechar caixa com divergencia."
          : "Nao foi possivel fechar o caixa.",
      success: false,
    };
  }

  return {
    session: closeResult.session,
    success: true,
  };
}
