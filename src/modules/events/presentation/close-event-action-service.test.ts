import { describe, expect, it, vi } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type { EventRepository } from "../application/event-repository";
import { closeEventActionService } from "./close-event-action-service";

describe("closeEventActionService", () => {
  it("closes an event from form data", async () => {
    const eventRepository = createEventRepository();
    const formData = new FormData();
    formData.set("eventId", "event-1");

    const result = await closeEventActionService({}, formData, {
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      eventRepository,
    });

    expect(result).toEqual({
      successMessage: "Evento finalizado com sucesso.",
    });
    expect(eventRepository.close).toHaveBeenCalledWith("event-1");
  });
});

function createCurrentUserProfileRepository(): CurrentUserProfileRepository {
  return {
    getCurrent: async () => ({
      profile: {
        id: "admin-1",
        role: "admin",
      },
      success: true,
    }),
  };
}

function createEventRepository(): EventRepository {
  return {
    close: vi.fn(async () => ({ success: true as const })),
    list: vi.fn(),
    listActive: vi.fn(),
    save: vi.fn(),
  };
}
