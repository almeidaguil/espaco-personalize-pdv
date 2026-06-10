import { createProduct, type Product } from "../domain/product";
import type { ProductRepository } from "./product-repository";
import { createProductSchema } from "./product-validation";

export type ProductIdGenerator = () => string;

export type CreateProductUseCaseResult =
  | {
      product: Product;
      success: true;
    }
  | {
      fieldErrors?: Partial<Record<"name" | "priceInCents" | "sku", string>>;
      formError?: string;
      success: false;
    };

type CreateProductUseCaseDependencies = {
  generateProductId: ProductIdGenerator;
  productRepository: ProductRepository;
};

export async function createProductUseCase(
  input: unknown,
  dependencies: CreateProductUseCaseDependencies,
): Promise<CreateProductUseCaseResult> {
  const parsedInput = createProductSchema.safeParse(input);

  if (!parsedInput.success) {
    const flattenedErrors = parsedInput.error.flatten().fieldErrors;

    return {
      fieldErrors: {
        name: flattenedErrors.name?.[0],
        priceInCents: flattenedErrors.priceInCents?.[0],
        sku: flattenedErrors.sku?.[0],
      },
      success: false,
    };
  }

  const productResult = createProduct({
    id: dependencies.generateProductId(),
    isActive: parsedInput.data.isActive,
    name: parsedInput.data.name,
    priceInCents: parsedInput.data.priceInCents,
    sku: parsedInput.data.sku,
  });

  if (!productResult.success) {
    return {
      formError: productResult.errors[0]?.message ?? "Produto invalido.",
      success: false,
    };
  }

  const saveResult = await dependencies.productRepository.save(
    productResult.product,
  );

  if (!saveResult.success) {
    return {
      formError:
        saveResult.error === "sku_already_exists"
          ? "Ja existe um produto com este SKU."
          : "Nao foi possivel salvar o produto.",
      success: false,
    };
  }

  return {
    product: saveResult.product,
    success: true,
  };
}
