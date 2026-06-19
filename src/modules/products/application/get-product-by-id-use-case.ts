import type { Product } from "../domain/product";
import type { ProductRepository } from "./product-repository";

export type GetProductByIdUseCaseResult =
  | {
      product: Product;
      success: true;
    }
  | {
      error: "not_found" | "unknown";
      success: false;
    };

type GetProductByIdUseCaseDependencies = {
  productRepository: ProductRepository;
};

export async function getProductByIdUseCase(
  productId: string,
  dependencies: GetProductByIdUseCaseDependencies,
): Promise<GetProductByIdUseCaseResult> {
  const normalizedProductId = productId.trim();

  if (!normalizedProductId) {
    return {
      error: "not_found",
      success: false,
    };
  }

  return dependencies.productRepository.findById(normalizedProductId);
}
