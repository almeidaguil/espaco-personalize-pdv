import { describe, expect, it } from "vitest";

import { Money } from "../domain/money";
import type { Product } from "../domain/product";
import type { ProductRepository } from "./product-repository";
import { listProductsUseCase } from "./list-products-use-case";

describe("listProductsUseCase", () => {
  it("returns products from the repository", async () => {
    const products: Product[] = [
      {
        id: "product-1",
        isActive: true,
        name: "Caneca personalizada",
        price: Money.fromReais(35),
        sku: "CANECA-001",
      },
    ];
    const productRepository: ProductRepository = {
      list: async () => ({ products, success: true }),
      save: async () => ({ error: "unknown", success: false }),
    };

    await expect(listProductsUseCase({ productRepository })).resolves.toEqual({
      products,
      success: true,
    });
  });

  it("maps repository errors to a presentation-safe message", async () => {
    const productRepository: ProductRepository = {
      list: async () => ({ error: "unknown", success: false }),
      save: async () => ({ error: "unknown", success: false }),
    };

    await expect(listProductsUseCase({ productRepository })).resolves.toEqual({
      formError: "Nao foi possivel carregar os produtos.",
      success: false,
    });
  });
});
