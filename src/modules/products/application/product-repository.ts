import type { Product } from "../domain/product";

export type SaveProductResult =
  | {
      product: Product;
      success: true;
    }
  | {
      error: "sku_already_exists" | "unknown";
      success: false;
    };

export type ListProductsResult =
  | {
      products: Product[];
      success: true;
    }
  | {
      error: "unknown";
      success: false;
    };

export type ProductRepository = {
  list(): Promise<ListProductsResult>;
  save(product: Product): Promise<SaveProductResult>;
};
