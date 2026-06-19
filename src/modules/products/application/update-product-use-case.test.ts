import { describe, expect, it } from "vitest";

import { Money } from "../domain/money";
import type { Product } from "../domain/product";
import { updateProductUseCase } from "./update-product-use-case";
import type {
  FindProductByIdResult,
  ListProductsResult,
  ProductRepository,
  SaveProductResult,
  UpdateProductResult,
} from "./product-repository";

class FakeProductRepository implements ProductRepository {
  public updatedProduct?: Product;

  constructor(private readonly updateResult?: UpdateProductResult) {}

  async findById(): Promise<FindProductByIdResult> {
    return {
      error: "not_found",
      success: false,
    };
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
    this.updatedProduct = product;

    return (
      this.updateResult ?? {
        product,
        success: true,
      }
    );
  }
}

describe("updateProductUseCase", () => {
  it("validates and updates a product", async () => {
    const productRepository = new FakeProductRepository();

    const result = await updateProductUseCase(
      "product-1",
      {
        isActive: false,
        name: " Caneca premium ",
        priceInReais: 42.5,
        sku: " CANECA-002 ",
      },
      {
        productRepository,
      },
    );

    expect(result).toEqual({
      product: {
        id: "product-1",
        isActive: false,
        name: "Caneca premium",
        price: Money.fromReais(42.5),
        sku: "CANECA-002",
      },
      success: true,
    });
    expect(productRepository.updatedProduct).toEqual({
      id: "product-1",
      isActive: false,
      name: "Caneca premium",
      price: Money.fromReais(42.5),
      sku: "CANECA-002",
    });
  });

  it("returns field errors when input is invalid", async () => {
    const productRepository = new FakeProductRepository();

    const result = await updateProductUseCase(
      "product-1",
      {
        name: "",
        priceInReais: -1,
      },
      {
        productRepository,
      },
    );

    expect(result).toEqual({
      fieldErrors: {
        name: "Informe o nome do produto.",
        priceInReais: "O preco nao pode ser negativo.",
        sku: undefined,
      },
      success: false,
    });
    expect(productRepository.updatedProduct).toBeUndefined();
  });

  it("maps duplicated SKU errors", async () => {
    const result = await updateProductUseCase(
      "product-1",
      {
        name: "Caneca personalizada",
        priceInReais: 35,
        sku: "CANECA-001",
      },
      {
        productRepository: new FakeProductRepository({
          error: "sku_already_exists",
          success: false,
        }),
      },
    );

    expect(result).toEqual({
      formError: "Ja existe um produto com este SKU.",
      success: false,
    });
  });

  it("maps product not found errors", async () => {
    const result = await updateProductUseCase(
      "product-1",
      {
        name: "Caneca personalizada",
        priceInReais: 35,
      },
      {
        productRepository: new FakeProductRepository({
          error: "not_found",
          success: false,
        }),
      },
    );

    expect(result).toEqual({
      formError: "Produto nao encontrado.",
      success: false,
    });
  });
});
