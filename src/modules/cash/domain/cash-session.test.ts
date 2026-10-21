import { describe, expect, it } from "vitest";

import {
  openCashSession,
  validateCashSessionReconciliations,
} from "./cash-session";

describe("openCashSession", () => {
  it("creates an open cash session with normalized ids", () => {
    const openedAt = new Date("2026-07-10T12:00:00.000Z");

    const result = openCashSession({
      id: " cash-session-1 ",
      openedAt,
      openingAmountInReais: 150.5,
      operatorId: " operator-1 ",
    });

    expect(result).toEqual({
      session: {
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

describe("validateCashSessionReconciliations", () => {
  it("accepts each payment method exactly once and permits explicit zero", () => {
    const reconciliations = [
      { countedAmountInCents: 0, method: "cash" as const },
      { countedAmountInCents: 1000, method: "pix" as const },
      { countedAmountInCents: 2000, method: "credit_card" as const },
      { countedAmountInCents: 3000, method: "debit_card" as const },
    ];

    expect(validateCashSessionReconciliations(reconciliations)).toEqual({
      reconciliations,
      success: true,
    });
  });

  it.each([
    {
      name: "a missing method",
      reconciliations: [
        { countedAmountInCents: 0, method: "cash" as const },
        { countedAmountInCents: 1000, method: "pix" as const },
        { countedAmountInCents: 2000, method: "credit_card" as const },
      ],
    },
    {
      name: "a duplicated method",
      reconciliations: [
        { countedAmountInCents: 0, method: "cash" as const },
        { countedAmountInCents: 1000, method: "pix" as const },
        { countedAmountInCents: 2000, method: "credit_card" as const },
        { countedAmountInCents: 3000, method: "credit_card" as const },
      ],
    },
    {
      name: "a negative amount",
      reconciliations: [
        { countedAmountInCents: -1, method: "cash" as const },
        { countedAmountInCents: 1000, method: "pix" as const },
        { countedAmountInCents: 2000, method: "credit_card" as const },
        { countedAmountInCents: 3000, method: "debit_card" as const },
      ],
    },
    {
      name: "an unsafe integer",
      reconciliations: [
        {
          countedAmountInCents: Number.MAX_SAFE_INTEGER + 1,
          method: "cash" as const,
        },
        { countedAmountInCents: 1000, method: "pix" as const },
        { countedAmountInCents: 2000, method: "credit_card" as const },
        { countedAmountInCents: 3000, method: "debit_card" as const },
      ],
    },
  ])("rejects $name", ({ reconciliations }) => {
    expect(validateCashSessionReconciliations(reconciliations)).toMatchObject({
      errors: [{ field: "reconciliations" }],
      success: false,
    });
  });
});
