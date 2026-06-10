import type { CreateProductUseCaseInput } from "../application/product-validation";

export function parseCreateProductFormData(
  formData: FormData,
): CreateProductUseCaseInput {
  return {
    isActive: parseOptionalBoolean(formData.getAll("isActive")),
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

function parseOptionalBoolean(values: FormDataEntryValue[]): boolean {
  if (values.length === 0) {
    return true;
  }

  return values.some((value) => value === "true");
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
