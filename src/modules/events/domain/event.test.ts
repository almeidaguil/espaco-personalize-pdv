import { describe, expect, it } from "vitest";

import { activateEvent, createEvent, deactivateEvent } from "./event";

describe("createEvent", () => {
  it("creates an active event with normalized fields", () => {
    const startsAt = new Date("2026-07-10T12:00:00.000Z");
    const endsAt = new Date("2026-07-10T22:00:00.000Z");

    const result = createEvent({
      endsAt,
      id: " event-1 ",
      location: " Centro de Eventos ",
      name: " Evento Julho ",
      startsAt,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.event).toEqual({
        endsAt,
        id: "event-1",
        isActive: true,
        location: "Centro de Eventos",
        name: "Evento Julho",
        startsAt,
      });
    }
  });

  it("creates an event without optional end date or location", () => {
    const startsAt = new Date("2026-07-10T12:00:00.000Z");

    const result = createEvent({
      id: "event-1",
      location: " ",
      name: "Evento Julho",
      startsAt,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.event).not.toHaveProperty("endsAt");
      expect(result.event).not.toHaveProperty("location");
    }
  });

  it("rejects events without name", () => {
    const result = createEvent({
      id: "event-1",
      name: " ",
      startsAt: new Date("2026-07-10T12:00:00.000Z"),
    });

    expect(result).toEqual({
      errors: [
        {
          field: "name",
          message: "Event name is required.",
        },
      ],
      success: false,
    });
  });

  it("rejects invalid start dates", () => {
    const result = createEvent({
      id: "event-1",
      name: "Evento Julho",
      startsAt: new Date("invalid"),
    });

    expect(result).toEqual({
      errors: [
        {
          field: "startsAt",
          message: "Event start date must be valid.",
        },
      ],
      success: false,
    });
  });

  it("rejects end dates before start dates", () => {
    const result = createEvent({
      endsAt: new Date("2026-07-10T11:00:00.000Z"),
      id: "event-1",
      name: "Evento Julho",
      startsAt: new Date("2026-07-10T12:00:00.000Z"),
    });

    expect(result).toEqual({
      errors: [
        {
          field: "endsAt",
          message: "Event end date must be after start date.",
        },
      ],
      success: false,
    });
  });
});

describe("event activation", () => {
  it("deactivates an event without changing schedule data", () => {
    const event = {
      id: "event-1",
      isActive: true,
      name: "Evento Julho",
      startsAt: new Date("2026-07-10T12:00:00.000Z"),
    };

    expect(deactivateEvent(event)).toEqual({
      ...event,
      isActive: false,
    });
  });

  it("activates an event without changing schedule data", () => {
    const event = {
      id: "event-1",
      isActive: false,
      name: "Evento Julho",
      startsAt: new Date("2026-07-10T12:00:00.000Z"),
    };

    expect(activateEvent(event)).toEqual({
      ...event,
      isActive: true,
    });
  });
});
