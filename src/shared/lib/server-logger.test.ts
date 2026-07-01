import { afterEach, describe, expect, it, vi } from "vitest";

import {
  logServerError,
  shouldLogUnexpectedActionError,
} from "./server-logger";

describe("server logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts sensitive context before logging", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    logServerError("sale.create.failed", {
      adminPassword: "admin-password-test",
      operation: "create-sale",
      payload: {
        email: "operator@example.com",
        saleId: "sale-1",
      },
    });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    const loggedPayload = JSON.parse(
      consoleErrorSpy.mock.calls[0]?.[0] as string,
    );

    expect(loggedPayload.context.adminPassword).toBe("[REDACTED]");
    expect(loggedPayload.context.payload.email).toBe("[REDACTED]");
    expect(loggedPayload.context.payload.saleId).toBe("sale-1");
  });

  it("only flags unexpected operational action errors", () => {
    expect(
      shouldLogUnexpectedActionError("Nao foi possivel registrar a venda."),
    ).toBe(true);
    expect(shouldLogUnexpectedActionError("Estoque insuficiente.")).toBe(false);
    expect(shouldLogUnexpectedActionError(undefined)).toBe(false);
  });
});
