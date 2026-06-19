import type { Event } from "../domain/event";
import type { EventRepository } from "./event-repository";

export type ListActiveEventsUseCaseResult =
  | {
      events: Event[];
      success: true;
    }
  | {
      formError: string;
      success: false;
    };

type ListActiveEventsUseCaseDependencies = {
  eventRepository: EventRepository;
};

export async function listActiveEventsUseCase({
  eventRepository,
}: ListActiveEventsUseCaseDependencies): Promise<ListActiveEventsUseCaseResult> {
  const result = await eventRepository.listActive();

  if (!result.success) {
    return {
      formError: "Nao foi possivel carregar os eventos ativos.",
      success: false,
    };
  }

  return {
    events: result.events,
    success: true,
  };
}
