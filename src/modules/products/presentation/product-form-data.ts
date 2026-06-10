import type { CreateProductUseCaseInput } from "../application/product-validation";

export function parseCreateProductFormData(
  formData: FormData,
): CreateProductUseCaseInput {
  return {
    isActive: parseOptionalBoolean(formData.get("isActive")),
    name: getTrimmedString(formData, "name"),
    priceInReais: parseBrlPrice(formData.get("priceInReais")),
    sku: getOptionalTrimmedString(formData, "sku"),
  };
}

function getTrimmedString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalTrimmedString(
  formData: FormData,
  key: string,
): string | null {
  const value = getTrimmedString(formData, key);

  return value ? value : null;
}

function parseOptionalBoolean(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") {
    return true;
  }

  return value !== "false";
}

function parseBrlPrice(value: FormDataEntryValue | null): number {
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
