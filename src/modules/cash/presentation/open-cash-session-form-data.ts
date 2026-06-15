import type { OpenCashSessionUseCaseInput } from "../application/cash-session-validation";

export function parseOpenCashSessionFormData(
  formData: FormData,
): OpenCashSessionUseCaseInput {
  return {
    eventId: getTrimmedString(formData, "eventId"),
    openingAmountInReais: parseBrlCurrencyInput(
      getTrimmedString(formData, "openingAmountInReais"),
    ),
  };
}

function getTrimmedString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export function parseBrlCurrencyInput(value: string): number {
  const normalizedValue = value
    .trim()
    .replace(/^R\$\s?/, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!normalizedValue) {
    return Number.NaN;
  }

  return Number(normalizedValue);
}
