import { describe, expect, it } from "vitest";

import { createEventUseCase } from "./create-event-use-case";
import type {
  EventRepository,
  ListEventsResult,
  SaveEventResult,
} from "./event-repository";
import type { Event } from "../domain/event";

class FakeEventRepository implements EventRepository {
  public savedEvent?: Event;

  constructor(private readonly saveResult?: SaveEventResult) {}

  async list(): Promise<ListEventsResult> {
    return {
      events: [],
      success: true,
    };
  }

  async listActive(): Promise<ListEventsResult> {
    return {
      events: [],
      success: true,
    };
  }

  async save(event: Event): Promise<SaveEventResult> {
    this.savedEvent = event;

    return (
      this.saveResult ?? {
        event,
        success: true,
      }
    );
  }
}

describe("createEventUseCase", () => {
  it("validates, creates and saves an event", async () => {
    const eventRepository = new FakeEventRepository();
    const startsAt = new Date("2026-07-10T12:00:00.000Z");
    const endsAt = new Date("2026-07-10T22:00:00.000Z");

    const result = await createEventUseCase(
      {
        endsAt,
        location: " Centro de Eventos ",
        name: " Evento Julho ",
        startsAt,
      },
      {
        eventRepository,
        generateEventId: () => "event-1",
      },
    );

    expect(result).toEqual({
      event: {
        endsAt,
        id: "event-1",
        isActive: true,
        location: "Centro de Eventos",
        name: "Evento Julho",
        startsAt,
      },
      success: true,
    });
    expect(eventRepository.savedEvent).toEqual({
      endsAt,
      id: "event-1",
      isActive: true,
      location: "Centro de Eventos",
      name: "Evento Julho",
      startsAt,
    });
  });

  it("returns field errors when input is invalid", async () => {
    const eventRepository = new FakeEventRepository();

    const result = await createEventUseCase(
      {
        endsAt: null,
        name: "",
        startsAt: new Date("invalid"),
      },
      {
        eventRepository,
        generateEventId: () => "event-1",
      },
    );

    expect(result).toEqual({
      fieldErrors: {
        endsAt: undefined,
        location: undefined,
        name: "Informe o nome do evento.",
        startsAt: "Informe uma data valida.",
      },
      success: false,
    });
    expect(eventRepository.savedEvent).toBeUndefined();
  });

  it("returns a form error when the schedule is invalid", async () => {
    const result = await createEventUseCase(
      {
        endsAt: new Date("2026-07-10T11:00:00.000Z"),
        name: "Evento Julho",
        startsAt: new Date("2026-07-10T12:00:00.000Z"),
      },
      {
        eventRepository: new FakeEventRepository(),
        generateEventId: () => "event-1",
      },
    );

    expect(result).toEqual({
      formError: "Event end date must be after start date.",
      success: false,
    });
  });

  it("maps unknown persistence errors", async () => {
    const eventRepository = new FakeEventRepository({
      error: "unknown",
      success: false,
    });

    const result = await createEventUseCase(
      {
        name: "Evento Julho",
        startsAt: new Date("2026-07-10T12:00:00.000Z"),
      },
      {
        eventRepository,
        generateEventId: () => "event-1",
      },
    );

    expect(result).toEqual({
      formError: "Nao foi possivel salvar o evento.",
      success: false,
    });
  });
});
