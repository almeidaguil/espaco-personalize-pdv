import type { OpenCashSessionUseCaseInput } from "../application/cash-session-validation";

export function parseOpenCashSessionFormData(
  formData: FormData,
): OpenCashSessionUseCaseInput {
  return {
    eventId: getTrimmedString(formData, "eventId"),
    openingAmountInReais: parseBrlAmount(formData.get("openingAmountInReais")),
  };
}

function getTrimmedString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function parseBrlAmount(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") {
    return Number.NaN;
  }

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
