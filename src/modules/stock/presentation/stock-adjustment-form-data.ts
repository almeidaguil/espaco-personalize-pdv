import type { AdjustStockUseCaseInput } from "../application/stock-validation";

export function parseStockAdjustmentFormData(
  formData: FormData,
): AdjustStockUseCaseInput {
  return {
    productId: getTrimmedString(formData, "productId"),
    quantity: parseInteger(formData.get("quantity")),
    type: parseAdjustmentType(formData.get("type")),
  };
}

function getTrimmedString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function parseInteger(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") {
    return Number.NaN;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return Number.NaN;
  }

  return Number(trimmedValue);
}

function parseAdjustmentType(
  value: FormDataEntryValue | null,
): AdjustStockUseCaseInput["type"] {
  return value === "manual_adjustment" ? value : "initial_adjustment";
}
