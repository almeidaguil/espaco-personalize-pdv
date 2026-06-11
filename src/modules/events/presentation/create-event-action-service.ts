import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";
import { requireAdminUseCase } from "@/modules/auth/application/require-admin-use-case";

import {
  createEventUseCase,
  type EventIdGenerator,
} from "../application/create-event-use-case";
import type { EventRepository } from "../application/event-repository";
import type { EventActionState } from "./event-action-state";
import { parseCreateEventFormData } from "./event-form-data";

type CreateEventActionServiceDependencies = {
  currentUserProfileRepository: CurrentUserProfileRepository;
  eventRepository: EventRepository;
  generateEventId: EventIdGenerator;
};

export async function createEventActionService(
  _previousState: EventActionState,
  formData: FormData,
  dependencies: CreateEventActionServiceDependencies,
): Promise<EventActionState> {
  const authorizationResult = await requireAdminUseCase(
    dependencies.currentUserProfileRepository,
  );

  if (!authorizationResult.success) {
    return {
      formError: authorizationResult.formError,
    };
  }

  const result = await createEventUseCase(parseCreateEventFormData(formData), {
    eventRepository: dependencies.eventRepository,
    generateEventId: dependencies.generateEventId,
  });

  if (!result.success) {
    return {
      fieldErrors: result.fieldErrors,
      formError: result.formError,
    };
  }

  return {
    successMessage: "Evento cadastrado com sucesso.",
  };
}
