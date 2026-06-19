import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import { openCashSession, type CashSession } from "../domain/cash-session";
import type { CashSessionRepository } from "./cash-session-repository";
import { openCashSessionSchema } from "./cash-session-validation";

export type CashSessionIdGenerator = () => string;
export type CashSessionDateProvider = () => Date;

export type OpenCashSessionUseCaseResult =
  | {
      session: CashSession;
      success: true;
    }
  | {
      fieldErrors?: Partial<Record<"eventId" | "openingAmountInReais", string>>;
      formError?: string;
      success: false;
    };

type OpenCashSessionUseCaseDependencies = {
  cashSessionRepository: CashSessionRepository;
  currentUserProfileRepository: CurrentUserProfileRepository;
  generateCashSessionId: CashSessionIdGenerator;
  getCurrentDate: CashSessionDateProvider;
};

export async function openCashSessionUseCase(
  input: unknown,
  dependencies: OpenCashSessionUseCaseDependencies,
): Promise<OpenCashSessionUseCaseResult> {
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

  const parsedInput = openCashSessionSchema.safeParse(input);

  if (!parsedInput.success) {
    const flattenedErrors = parsedInput.error.flatten().fieldErrors;

    return {
      fieldErrors: {
        eventId: flattenedErrors.eventId?.[0],
        openingAmountInReais: flattenedErrors.openingAmountInReais?.[0],
      },
      success: false,
    };
  }

  const existingOpenSessionResult =
    await dependencies.cashSessionRepository.findOpenByEventAndOperator({
      eventId: parsedInput.data.eventId,
      operatorId: currentProfileResult.profile.id,
    });

  if (!existingOpenSessionResult.success) {
    return {
      formError: "Nao foi possivel verificar o caixa aberto.",
      success: false,
    };
  }

  if (existingOpenSessionResult.session) {
    return {
      formError: "Ja existe um caixa aberto para este evento.",
      success: false,
    };
  }

  const cashSessionResult = openCashSession({
    eventId: parsedInput.data.eventId,
    id: dependencies.generateCashSessionId(),
    openedAt: dependencies.getCurrentDate(),
    openingAmountInReais: parsedInput.data.openingAmountInReais,
    operatorId: currentProfileResult.profile.id,
  });

  if (!cashSessionResult.success) {
    return {
      formError: cashSessionResult.errors[0]?.message ?? "Caixa invalido.",
      success: false,
    };
  }

  const saveResult = await dependencies.cashSessionRepository.save(
    cashSessionResult.session,
  );

  if (!saveResult.success) {
    return {
      formError:
        saveResult.error === "open_session_already_exists"
          ? "Ja existe um caixa aberto para este evento."
          : "Nao foi possivel abrir o caixa.",
      success: false,
    };
  }

  return {
    session: saveResult.session,
    success: true,
  };
}
