import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import { closeEventUseCase } from "../application/close-event-use-case";
import type { EventRepository } from "../application/event-repository";
import { parseCloseEventFormData } from "./close-event-form-data";
import type { EventActionState } from "./event-action-state";

type CloseEventActionServiceDependencies = {
  currentUserProfileRepository: CurrentUserProfileRepository;
  eventRepository: EventRepository;
};

export async function closeEventActionService(
  _previousState: EventActionState,
  formData: FormData,
  dependencies: CloseEventActionServiceDependencies,
): Promise<EventActionState> {
  const result = await closeEventUseCase(
    parseCloseEventFormData(formData),
    dependencies,
  );

  if (!result.success) {
    return {
      formError: result.formError,
    };
  }

  return {
    successMessage: "Evento finalizado com sucesso.",
  };
}
