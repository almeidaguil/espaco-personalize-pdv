import { describe, expect, it } from "vitest";

import { getProductByIdUseCase } from "./get-product-by-id-use-case";
import type {
  FindProductByIdResult,
  ListProductsResult,
  ProductRepository,
  SaveProductResult,
  UpdateProductResult,
} from "./product-repository";
import { Money } from "../domain/money";
import type { Product } from "../domain/product";

class FakeProductRepository implements ProductRepository {
  constructor(private readonly findByIdResult: FindProductByIdResult) {}

  async findById(): Promise<FindProductByIdResult> {
    return this.findByIdResult;
  }

  async list(): Promise<ListProductsResult> {
    return {
      products: [],
      success: true,
    };
  }

  async save(product: Product): Promise<SaveProductResult> {
    return {
      product,
      success: true,
    };
  }

  async update(product: Product): Promise<UpdateProductResult> {
    return {
      product,
      success: true,
    };
  }
}

describe("getProductByIdUseCase", () => {
  it("returns not found when product id is blank", async () => {
    await expect(
      getProductByIdUseCase(" ", {
        productRepository: new FakeProductRepository({
          error: "unknown",
          success: false,
        }),
      }),
    ).resolves.toEqual({
      error: "not_found",
      success: false,
    });
  });

  it("returns the product when repository finds it", async () => {
    const product: Product = {
      id: "product-1",
      isActive: true,
      name: "Caneca personalizada",
      price: Money.fromReais(35),
      sku: "CANECA-001",
    };

    await expect(
      getProductByIdUseCase("product-1", {
        productRepository: new FakeProductRepository({
          product,
          success: true,
        }),
      }),
    ).resolves.toEqual({
      product,
      success: true,
    });
  });
});
