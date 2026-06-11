import { describe, expect, it } from "vitest";

import type { Event } from "../domain/event";
import type { EventRepository } from "./event-repository";
import { listEventsUseCase } from "./list-events-use-case";

describe("listEventsUseCase", () => {
  it("returns events from the repository", async () => {
    const events: Event[] = [
      {
        id: "event-1",
        isActive: true,
        location: "Centro de Eventos",
        name: "Evento Julho",
        startsAt: new Date("2026-07-10T12:00:00.000Z"),
      },
    ];
    const eventRepository: EventRepository = {
      list: async () => ({ events, success: true }),
      listActive: async () => ({ events: [], success: true }),
      save: async () => ({ error: "unknown", success: false }),
    };

    await expect(listEventsUseCase({ eventRepository })).resolves.toEqual({
      events,
      success: true,
    });
  });

  it("maps repository errors to a presentation-safe message", async () => {
    const eventRepository: EventRepository = {
      list: async () => ({ error: "unknown", success: false }),
      listActive: async () => ({ events: [], success: true }),
      save: async () => ({ error: "unknown", success: false }),
    };

    await expect(listEventsUseCase({ eventRepository })).resolves.toEqual({
      formError: "Nao foi possivel carregar os eventos.",
      success: false,
    });
  });
});
