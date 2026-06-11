import { describe, expect, it } from "vitest";

import {
  closeCashSession,
  type CashSession,
  openCashSession,
} from "./cash-session";

describe("openCashSession", () => {
  it("creates an open cash session with normalized ids", () => {
    const openedAt = new Date("2026-07-10T12:00:00.000Z");

    const result = openCashSession({
      eventId: " event-1 ",
      id: " cash-session-1 ",
      openedAt,
      openingAmountInReais: 150.5,
      operatorId: " operator-1 ",
    });

    expect(result).toEqual({
      session: {
        eventId: "event-1",
        id: "cash-session-1",
        openedAt,
        openingAmountInReais: 150.5,
        operatorId: "operator-1",
        status: "open",
      },
      success: true,
    });
  });

  it("rejects required ids and invalid open dates", () => {
    const result = openCashSession({
      eventId: " ",
      id: " ",
      openedAt: new Date("invalid"),
      openingAmountInReais: 0,
      operatorId: " ",
    });

    expect(result).toEqual({
      errors: [
        {
          field: "id",
          message: "Cash session id is required.",
        },
        {
          field: "eventId",
          message: "Cash session event id is required.",
        },
        {
          field: "operatorId",
          message: "Cash session operator id is required.",
        },
        {
          field: "openedAt",
          message: "Cash session open date must be valid.",
        },
      ],
      success: false,
    });
  });

  it("rejects negative opening amounts", () => {
    const result = openCashSession({
      eventId: "event-1",
      id: "cash-session-1",
      openedAt: new Date("2026-07-10T12:00:00.000Z"),
      openingAmountInReais: -1,
      operatorId: "operator-1",
    });

    expect(result).toEqual({
      errors: [
        {
          field: "openingAmountInReais",
          message: "Opening amount cannot be negative.",
        },
      ],
      success: false,
    });
  });

  it("rejects opening amounts with more than 2 decimal places", () => {
    const result = openCashSession({
      eventId: "event-1",
      id: "cash-session-1",
      openedAt: new Date("2026-07-10T12:00:00.000Z"),
      openingAmountInReais: 10.999,
      operatorId: "operator-1",
    });

    expect(result).toEqual({
      errors: [
        {
          field: "openingAmountInReais",
          message: "Opening amount can have at most 2 decimal places.",
        },
      ],
      success: false,
    });
  });
});

describe("closeCashSession", () => {
  it("closes an open cash session", () => {
    const session = createOpenSession();
    const closedAt = new Date("2026-07-10T22:00:00.000Z");

    expect(
      closeCashSession({
        closedAt,
        session,
      }),
    ).toEqual({
      session: {
        ...session,
        closedAt,
        status: "closed",
      },
      success: true,
    });
  });

  it("rejects sessions that are already closed", () => {
    const session: CashSession = {
      ...createOpenSession(),
      closedAt: new Date("2026-07-10T22:00:00.000Z"),
      status: "closed",
    };

    const result = closeCashSession({
      closedAt: new Date("2026-07-10T23:00:00.000Z"),
      session,
    });

    expect(result).toEqual({
      errors: [
        {
          field: "status",
          message: "Only open cash sessions can be closed.",
        },
      ],
      success: false,
    });
  });

  it("rejects close dates before open dates", () => {
    const result = closeCashSession({
      closedAt: new Date("2026-07-10T11:00:00.000Z"),
      session: createOpenSession(),
    });

    expect(result).toEqual({
      errors: [
        {
          field: "closedAt",
          message: "Cash session close date must be after open date.",
        },
      ],
      success: false,
    });
  });
});

function createOpenSession(): CashSession {
  return {
    eventId: "event-1",
    id: "cash-session-1",
    openedAt: new Date("2026-07-10T12:00:00.000Z"),
    openingAmountInReais: 150.5,
    operatorId: "operator-1",
    status: "open",
  };
}
