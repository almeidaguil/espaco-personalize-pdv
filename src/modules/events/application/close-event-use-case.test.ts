import { describe, expect, it, vi } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import { closeEventUseCase } from "./close-event-use-case";
import type { EventRepository } from "./event-repository";

describe("closeEventUseCase", () => {
  it("closes an active event for admins", async () => {
    const eventRepository = createEventRepository();

    const result = await closeEventUseCase(" event-1 ", {
      currentUserProfileRepository: createCurrentUserProfileRepository("admin"),
      eventRepository,
    });

    expect(result).toEqual({
      success: true,
    });
    expect(eventRepository.close).toHaveBeenCalledWith("event-1");
  });

  it("rejects operators", async () => {
    const eventRepository = createEventRepository();

    const result = await closeEventUseCase("event-1", {
      currentUserProfileRepository:
        createCurrentUserProfileRepository("operator"),
      eventRepository,
    });

    expect(result).toEqual({
      formError: "Apenas administradores podem finalizar eventos.",
      success: false,
    });
    expect(eventRepository.close).not.toHaveBeenCalled();
  });

  it("maps open cash session errors", async () => {
    const result = await closeEventUseCase("event-1", {
      currentUserProfileRepository: createCurrentUserProfileRepository("admin"),
      eventRepository: createEventRepository({
        error: "open_cash_sessions",
        success: false,
      }),
    });

    expect(result).toEqual({
      formError: "Feche todos os caixas abertos antes de finalizar o evento.",
      success: false,
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

function createEventRepository(
  closeResult: Awaited<ReturnType<EventRepository["close"]>> = {
    success: true,
  },
): EventRepository {
  return {
    close: vi.fn(async () => closeResult),
    list: vi.fn(),
    listActive: vi.fn(),
    save: vi.fn(),
  };
}
