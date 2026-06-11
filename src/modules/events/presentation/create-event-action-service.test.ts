import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type {
  EventRepository,
  ListEventsResult,
  SaveEventResult,
} from "../application/event-repository";
import type { Event } from "../domain/event";
import { createEventActionService } from "./create-event-action-service";

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

describe("createEventActionService", () => {
  it("creates an event for admin users", async () => {
    const eventRepository = new FakeEventRepository();

    const result = await createEventActionService(
      {},
      createFormData({
        endsAt: "2026-07-10T18:00",
        location: "Centro de Eventos",
        name: "Evento Julho",
        startsAt: "2026-07-10T09:00",
      }),
      {
        currentUserProfileRepository:
          createCurrentUserProfileRepository("admin"),
        eventRepository,
        generateEventId: () => "event-1",
      },
    );

    expect(result).toEqual({
      successMessage: "Evento cadastrado com sucesso.",
    });
    expect(eventRepository.savedEvent).toMatchObject({
      id: "event-1",
      isActive: true,
      location: "Centro de Eventos",
      name: "Evento Julho",
    });
  });

  it("blocks operator users before creating events", async () => {
    const eventRepository = new FakeEventRepository();

    const result = await createEventActionService(
      {},
      createFormData({
        endsAt: "2026-07-10T18:00",
        location: "Centro de Eventos",
        name: "Evento Julho",
        startsAt: "2026-07-10T09:00",
      }),
      {
        currentUserProfileRepository:
          createCurrentUserProfileRepository("operator"),
        eventRepository,
        generateEventId: () => "event-1",
      },
    );

    expect(result).toEqual({
      formError: "Acesso restrito a administradores.",
    });
    expect(eventRepository.savedEvent).toBeUndefined();
  });

  it("returns field errors from event validation", async () => {
    const result = await createEventActionService(
      {},
      createFormData({
        endsAt: "",
        location: "",
        name: "",
        startsAt: "",
      }),
      {
        currentUserProfileRepository:
          createCurrentUserProfileRepository("admin"),
        eventRepository: new FakeEventRepository(),
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
      formError: undefined,
    });
  });
});

function createCurrentUserProfileRepository(
  role: "admin" | "operator",
): CurrentUserProfileRepository {
  return {
    getCurrent: async () => ({
      profile: {
        id: "user-1",
        role,
      },
      success: true,
    }),
  };
}

function createFormData(input: {
  endsAt: string;
  location: string;
  name: string;
  startsAt: string;
}): FormData {
  const formData = new FormData();
  formData.set("endsAt", input.endsAt);
  formData.set("location", input.location);
  formData.set("name", input.name);
  formData.set("startsAt", input.startsAt);

  return formData;
}
