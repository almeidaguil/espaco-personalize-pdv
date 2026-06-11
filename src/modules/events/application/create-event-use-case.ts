import { createEvent, type Event } from "../domain/event";
import type { EventRepository } from "./event-repository";
import { createEventSchema } from "./event-validation";

export type EventIdGenerator = () => string;

export type CreateEventUseCaseResult =
  | {
      event: Event;
      success: true;
    }
  | {
      fieldErrors?: Partial<
        Record<"endsAt" | "location" | "name" | "startsAt", string>
      >;
      formError?: string;
      success: false;
    };

type CreateEventUseCaseDependencies = {
  eventRepository: EventRepository;
  generateEventId: EventIdGenerator;
};

export async function createEventUseCase(
  input: unknown,
  dependencies: CreateEventUseCaseDependencies,
): Promise<CreateEventUseCaseResult> {
  const parsedInput = createEventSchema.safeParse(input);

  if (!parsedInput.success) {
    const flattenedErrors = parsedInput.error.flatten().fieldErrors;

    return {
      fieldErrors: {
        endsAt: flattenedErrors.endsAt?.[0],
        location: flattenedErrors.location?.[0],
        name: flattenedErrors.name?.[0],
        startsAt: flattenedErrors.startsAt?.[0],
      },
      success: false,
    };
  }

  const eventResult = createEvent({
    endsAt: parsedInput.data.endsAt,
    id: dependencies.generateEventId(),
    isActive: parsedInput.data.isActive,
    location: parsedInput.data.location,
    name: parsedInput.data.name,
    startsAt: parsedInput.data.startsAt,
  });

  if (!eventResult.success) {
    return {
      formError: eventResult.errors[0]?.message ?? "Evento invalido.",
      success: false,
    };
  }

  const saveResult = await dependencies.eventRepository.save(eventResult.event);

  if (!saveResult.success) {
    return {
      formError: "Nao foi possivel salvar o evento.",
      success: false,
    };
  }

  return {
    event: saveResult.event,
    success: true,
  };
}
