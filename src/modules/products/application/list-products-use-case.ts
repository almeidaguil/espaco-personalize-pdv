import type { Product } from "../domain/product";
import type { ProductRepository } from "./product-repository";

export type ListProductsUseCaseResult =
  | {
      products: Product[];
      success: true;
    }
  | {
      formError: string;
      success: false;
    };

type ListProductsUseCaseDependencies = {
  productRepository: ProductRepository;
};

export async function listProductsUseCase({
  productRepository,
}: ListProductsUseCaseDependencies): Promise<ListProductsUseCaseResult> {
  const result = await productRepository.list();

  if (!result.success) {
    return {
      formError: "Nao foi possivel carregar os produtos.",
      success: false,
    };
  }

  return {
    products: result.products,
    success: true,
  };
}
