import { createProduct, type Product } from "../domain/product";
import type { ProductRepository } from "./product-repository";
import { createProductSchema } from "./product-validation";

export type UpdateProductUseCaseResult =
  | {
      product: Product;
      success: true;
    }
  | {
      fieldErrors?: Partial<Record<"name" | "priceInReais" | "sku", string>>;
      formError?: string;
      success: false;
    };

type UpdateProductUseCaseDependencies = {
  productRepository: ProductRepository;
};

export async function updateProductUseCase(
  productId: string,
  input: unknown,
  dependencies: UpdateProductUseCaseDependencies,
): Promise<UpdateProductUseCaseResult> {
  const normalizedProductId = productId.trim();

  if (!normalizedProductId) {
    return {
      formError: "Produto nao encontrado.",
      success: false,
    };
  }

  const parsedInput = createProductSchema.safeParse(input);

  if (!parsedInput.success) {
    const flattenedErrors = parsedInput.error.flatten().fieldErrors;

    return {
      fieldErrors: {
        name: flattenedErrors.name?.[0],
        priceInReais: flattenedErrors.priceInReais?.[0],
        sku: flattenedErrors.sku?.[0],
      },
      success: false,
    };
  }

  const productResult = createProduct({
    id: normalizedProductId,
    isActive: parsedInput.data.isActive,
    name: parsedInput.data.name,
    priceInReais: parsedInput.data.priceInReais,
    sku: parsedInput.data.sku,
  });

  if (!productResult.success) {
    return {
      formError: productResult.errors[0]?.message ?? "Produto invalido.",
      success: false,
    };
  }

  const updateResult = await dependencies.productRepository.update(
    productResult.product,
  );

  if (!updateResult.success) {
    return {
      formError:
        updateResult.error === "sku_already_exists"
          ? "Ja existe um produto com este SKU."
          : updateResult.error === "not_found"
            ? "Produto nao encontrado."
            : "Nao foi possivel atualizar o produto.",
      success: false,
    };
  }

  return {
    product: updateResult.product,
    success: true,
  };
}
