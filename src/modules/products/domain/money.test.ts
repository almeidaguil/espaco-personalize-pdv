import { describe, expect, it } from "vitest";

import { Money } from "./money";

describe("Money", () => {
  it("represents BRL amounts from Reais", () => {
    const money = Money.fromReais(35);

    expect(money.currency).toBe("BRL");
    expect(money.toReais()).toBe(35);
    expect(money.toCents()).toBe(3500);
  });

  it("preserves cents from BRL decimal amounts", () => {
    const money = Money.fromReais(35.99);

    expect(money.toReais()).toBe(35.99);
    expect(money.toCents()).toBe(3599);
  });

  it("recreates BRL amounts from cents for persistence mapping", () => {
    const money = Money.fromCents(3500);

    expect(money.currency).toBe("BRL");
    expect(money.toReais()).toBe(35);
    expect(money.toCents()).toBe(3500);
  });
});
