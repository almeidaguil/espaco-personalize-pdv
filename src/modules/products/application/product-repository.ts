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

export type FindProductByIdResult =
  | {
      product: Product;
      success: true;
    }
  | {
      error: "not_found" | "unknown";
      success: false;
    };

export type UpdateProductResult =
  | {
      product: Product;
      success: true;
    }
  | {
      error: "not_found" | "sku_already_exists" | "unknown";
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
  findById(productId: string): Promise<FindProductByIdResult>;
  list(): Promise<ListProductsResult>;
  save(product: Product): Promise<SaveProductResult>;
  update(product: Product): Promise<UpdateProductResult>;
};
