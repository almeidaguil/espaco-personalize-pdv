import type { CreateProductUseCaseInput } from "../application/product-validation";
import { normalizeProductSku } from "../domain/product";
import type { ProductFormValues } from "./product-action-state";

export function parseCreateProductFormData(
  formData: FormData,
): CreateProductUseCaseInput {
  return {
    isActive: parseOptionalBoolean(formData.getAll("isActive")),
    name: getTrimmedString(formData, "name"),
    priceInReais: parseBrlPrice(formData.get("priceInReais")),
    sku: normalizeProductSku(getTrimmedString(formData, "sku")) ?? null,
  };
}

export function getProductFormValues(formData: FormData): ProductFormValues {
  return {
    isActive: parseOptionalBoolean(formData.getAll("isActive")),
    name: getTrimmedString(formData, "name"),
    priceInReais: getTrimmedString(formData, "priceInReais"),
    sku: normalizeProductSku(getTrimmedString(formData, "sku")) ?? "",
  };
}

export function createEmptyProductFormValues(): ProductFormValues {
  return {
    isActive: true,
    name: "",
    priceInReais: "",
    sku: "",
  };
}

export function createProductFormValuesFromProduct(input: {
  isActive: boolean;
  name: string;
  priceInReais: number;
  sku?: string;
}): ProductFormValues {
  return {
    isActive: input.isActive,
    name: input.name,
    priceInReais: input.priceInReais.toFixed(2).replace(".", ","),
    sku: normalizeProductSku(input.sku) ?? "",
  };
}

function getTrimmedString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
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
