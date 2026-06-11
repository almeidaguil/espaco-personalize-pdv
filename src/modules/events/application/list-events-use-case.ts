import type { Event } from "../domain/event";
import type { EventRepository } from "./event-repository";

export type ListEventsUseCaseResult =
  | {
      events: Event[];
      success: true;
    }
  | {
      formError: string;
      success: false;
    };

type ListEventsUseCaseDependencies = {
  eventRepository: EventRepository;
};

export async function listEventsUseCase({
  eventRepository,
}: ListEventsUseCaseDependencies): Promise<ListEventsUseCaseResult> {
  const result = await eventRepository.list();

  if (!result.success) {
    return {
      formError: "Nao foi possivel carregar os eventos.",
      success: false,
    };
  }

  return {
    events: result.events,
    success: true,
  };
}
