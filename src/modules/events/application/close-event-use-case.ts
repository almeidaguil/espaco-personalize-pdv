import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type { EventRepository } from "./event-repository";

export type CloseEventUseCaseResult =
  | {
      success: true;
    }
  | {
      formError: string;
      success: false;
    };

type CloseEventUseCaseDependencies = {
  currentUserProfileRepository: CurrentUserProfileRepository;
  eventRepository: EventRepository;
};

export async function closeEventUseCase(
  eventIdInput: string,
  dependencies: CloseEventUseCaseDependencies,
): Promise<CloseEventUseCaseResult> {
  const eventId = eventIdInput.trim();

  if (!eventId) {
    return {
      formError: "Evento nao encontrado.",
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

  if (currentProfileResult.profile.role !== "admin") {
    return {
      formError: "Apenas administradores podem finalizar eventos.",
      success: false,
    };
  }

  const closeResult = await dependencies.eventRepository.close(eventId);

  if (!closeResult.success) {
    return {
      formError:
        closeResult.error === "open_cash_sessions"
          ? "Feche todos os caixas abertos antes de finalizar o evento."
          : closeResult.error === "already_closed"
            ? "Evento ja finalizado."
            : "Nao foi possivel finalizar o evento.",
      success: false,
    };
  }

  return {
    success: true,
  };
}
