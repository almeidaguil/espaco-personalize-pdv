export function parseBrlCurrencyToCents(value: string): number {
  const normalizedValue = value.trim().replace(/^R\$\s*/, "");
  const match = /^(\d+|[1-9]\d{0,2}(?:\.\d{3})+)(?:,(\d{1,2}))?$/.exec(
    normalizedValue,
  );

  if (!match) {
    return Number.NaN;
  }

  const wholeReais = match[1].replaceAll(".", "");
  const decimalCents = (match[2] ?? "").padEnd(2, "0");
  const wholeReaisValue = Number(wholeReais);
  const decimalCentsValue = Number(decimalCents || "0");

  if (
    !Number.isSafeInteger(wholeReaisValue) ||
    wholeReaisValue >
      Math.floor((Number.MAX_SAFE_INTEGER - decimalCentsValue) / 100)
  ) {
    return Number.NaN;
  }

  return wholeReaisValue * 100 + decimalCentsValue;
}

export function formatBrlCentsForInput(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("BRL cents must be a non-negative safe integer.");
  }

  const wholeReais = Math.floor(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimalCents = (cents % 100).toString().padStart(2, "0");

  return `${wholeReais},${decimalCents}`;
}
