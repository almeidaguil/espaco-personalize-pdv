import { describe, expect, it } from "vitest";

import type { Event } from "../domain/event";
import type { EventRepository } from "./event-repository";
import { listActiveEventsUseCase } from "./list-active-events-use-case";

describe("listActiveEventsUseCase", () => {
  it("returns active events from the repository", async () => {
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
      close: async () => ({ success: true }),
      list: async () => ({ events: [], success: true }),
      listActive: async () => ({ events, success: true }),
      save: async () => ({ error: "unknown", success: false }),
    };

    await expect(listActiveEventsUseCase({ eventRepository })).resolves.toEqual(
      {
        events,
        success: true,
      },
    );
  });

  it("maps repository errors to a presentation-safe message", async () => {
    const eventRepository: EventRepository = {
      close: async () => ({ success: true }),
      list: async () => ({ events: [], success: true }),
      listActive: async () => ({ error: "unknown", success: false }),
      save: async () => ({ error: "unknown", success: false }),
    };

    await expect(listActiveEventsUseCase({ eventRepository })).resolves.toEqual(
      {
        formError: "Nao foi possivel carregar os eventos ativos.",
        success: false,
      },
    );
  });
});
