import { describe, expect, it } from "vitest";

import { createProductUseCase } from "./create-product-use-case";
import type {
  ProductRepository,
  SaveProductResult,
} from "./product-repository";
import type { Product } from "../domain/product";

class FakeProductRepository implements ProductRepository {
  public savedProduct?: Product;

  constructor(private readonly saveResult?: SaveProductResult) {}

  async save(product: Product): Promise<SaveProductResult> {
    this.savedProduct = product;

    return (
      this.saveResult ?? {
        product,
        success: true,
      }
    );
  }
}

describe("createProductUseCase", () => {
  it("validates, creates and saves a product", async () => {
    const productRepository = new FakeProductRepository();

    const result = await createProductUseCase(
      {
        name: " Caneca personalizada ",
        priceInCents: 3500,
        sku: " CANECA-001 ",
      },
      {
        generateProductId: () => "product-1",
        productRepository,
      },
    );

    expect(result).toEqual({
      product: {
        id: "product-1",
        isActive: true,
        name: "Caneca personalizada",
        priceInCents: 3500,
        sku: "CANECA-001",
      },
      success: true,
    });
    expect(productRepository.savedProduct).toEqual({
      id: "product-1",
      isActive: true,
      name: "Caneca personalizada",
      priceInCents: 3500,
      sku: "CANECA-001",
    });
  });

  it("returns field errors when input is invalid", async () => {
    const productRepository = new FakeProductRepository();

    const result = await createProductUseCase(
      {
        name: "",
        priceInCents: -1,
      },
      {
        generateProductId: () => "product-1",
        productRepository,
      },
    );

    expect(result).toEqual({
      fieldErrors: {
        name: "Informe o nome do produto.",
        priceInCents: "O preco nao pode ser negativo.",
        sku: undefined,
      },
      success: false,
    });
    expect(productRepository.savedProduct).toBeUndefined();
  });

  it("maps duplicated SKU errors", async () => {
    const productRepository = new FakeProductRepository({
      error: "sku_already_exists",
      success: false,
    });

    const result = await createProductUseCase(
      {
        name: "Caneca personalizada",
        priceInCents: 3500,
        sku: "CANECA-001",
      },
      {
        generateProductId: () => "product-1",
        productRepository,
      },
    );

    expect(result).toEqual({
      formError: "Ja existe um produto com este SKU.",
      success: false,
    });
  });

  it("maps unknown persistence errors", async () => {
    const productRepository = new FakeProductRepository({
      error: "unknown",
      success: false,
    });

    const result = await createProductUseCase(
      {
        name: "Caneca personalizada",
        priceInCents: 3500,
      },
      {
        generateProductId: () => "product-1",
        productRepository,
      },
    );

    expect(result).toEqual({
      formError: "Nao foi possivel salvar o produto.",
      success: false,
    });
  });
});
