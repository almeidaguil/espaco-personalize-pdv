import { describe, expect, it } from "vitest";

import {
  formatBrlCentsForInput,
  parseBrlCurrencyToCents,
} from "./brl-currency";

describe("parseBrlCurrencyToCents", () => {
  it.each([
    ["0", 0],
    ["0,01", 1],
    ["10", 1000],
    ["10,5", 1050],
    ["1.234,56", 123456],
    [" R$ 10,00 ", 1000],
  ])("parses %s as exact integer cents", (input, expected) => {
    expect(parseBrlCurrencyToCents(input)).toBe(expected);
  });

  it.each(["", " ", "R$", "texto", "-0,01", "1,001", "12.34,56"])(
    "rejects invalid BRL input %s without rounding",
    (input) => {
      expect(parseBrlCurrencyToCents(input)).toBeNaN();
    },
  );
});

describe("formatBrlCentsForInput", () => {
  it.each([
    [0, "0,00"],
    [1, "0,01"],
    [1050, "10,50"],
    [123456, "1.234,56"],
  ])("formats %i cents as %s", (cents, expected) => {
    expect(formatBrlCentsForInput(cents)).toBe(expected);
  });

  it.each([Number.NaN, 1.5, -1])("rejects invalid cents %s", (cents) => {
    expect(() => formatBrlCentsForInput(cents)).toThrow(
      "BRL cents must be a non-negative safe integer.",
    );
  });
});
