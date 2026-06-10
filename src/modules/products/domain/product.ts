export type Product = {
  id: string;
  isActive: boolean;
  name: string;
  priceInCents: number;
  sku?: string;
};

export type CreateProductInput = {
  id: string;
  isActive?: boolean;
  name: string;
  priceInCents: number;
  sku?: string | null;
};

export type ProductValidationError = {
  field: "id" | "name" | "priceInCents" | "sku";
  message: string;
};

export type CreateProductResult =
  | {
      product: Product;
      success: true;
    }
  | {
      errors: ProductValidationError[];
      success: false;
    };

export function createProduct(input: CreateProductInput): CreateProductResult {
  const errors: ProductValidationError[] = [];
  const id = input.id.trim();
  const name = input.name.trim();
  const sku = normalizeSku(input.sku);

  if (!id) {
    errors.push({
      field: "id",
      message: "Product id is required.",
    });
  }

  if (!name) {
    errors.push({
      field: "name",
      message: "Product name is required.",
    });
  }

  if (!Number.isInteger(input.priceInCents)) {
    errors.push({
      field: "priceInCents",
      message: "Product price must be represented in cents.",
    });
  }

  if (input.priceInCents < 0) {
    errors.push({
      field: "priceInCents",
      message: "Product price cannot be negative.",
    });
  }

  if (sku && sku.length > 64) {
    errors.push({
      field: "sku",
      message: "Product SKU cannot exceed 64 characters.",
    });
  }

  if (errors.length > 0) {
    return {
      errors,
      success: false,
    };
  }

  return {
    product: {
      id,
      isActive: input.isActive ?? true,
      name,
      priceInCents: input.priceInCents,
      ...(sku ? { sku } : {}),
    },
    success: true,
  };
}

export function deactivateProduct(product: Product): Product {
  return {
    ...product,
    isActive: false,
  };
}

export function activateProduct(product: Product): Product {
  return {
    ...product,
    isActive: true,
  };
}

function normalizeSku(sku: string | null | undefined): string | undefined {
  const normalizedSku = sku?.trim();

  return normalizedSku ? normalizedSku : undefined;
}
