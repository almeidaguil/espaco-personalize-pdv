import { Money } from "../domain/money";
import type { Product } from "../domain/product";
import type {
  ProductRepository,
  SaveProductResult,
} from "../application/product-repository";

type SupabaseProductRow = {
  id: string;
  is_active: boolean;
  name: string;
  price_in_cents: number;
  sku: string | null;
};

type SupabaseProductInsert = {
  id: string;
  is_active: boolean;
  name: string;
  price_in_cents: number;
  sku: string | null;
};

type SupabaseError = {
  code?: string;
  details?: string;
  message?: string;
};

type SupabaseProductClient = {
  from(table: "products"): {
    insert(payload: SupabaseProductInsert): {
      select(columns: string): {
        single(): Promise<{
          data: SupabaseProductRow | null;
          error: SupabaseError | null;
        }>;
      };
    };
  };
};

export class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly supabaseClient: SupabaseProductClient) {}

  async save(product: Product): Promise<SaveProductResult> {
    const { data, error } = await this.supabaseClient
      .from("products")
      .insert(toProductInsert(product))
      .select("id,name,sku,price_in_cents,is_active")
      .single();

    if (error) {
      return {
        error: isSkuUniqueViolation(error) ? "sku_already_exists" : "unknown",
        success: false,
      };
    }

    if (!data) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      product: toProduct(data),
      success: true,
    };
  }
}

function toProductInsert(product: Product): SupabaseProductInsert {
  return {
    id: product.id,
    is_active: product.isActive,
    name: product.name,
    price_in_cents: product.price.toCents(),
    sku: product.sku ?? null,
  };
}

function toProduct(row: SupabaseProductRow): Product {
  return {
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    price: Money.fromCents(row.price_in_cents),
    ...(row.sku ? { sku: row.sku } : {}),
  };
}

function isSkuUniqueViolation(error: SupabaseError): boolean {
  const errorText = `${error.code ?? ""} ${error.details ?? ""} ${
    error.message ?? ""
  }`.toLowerCase();

  return errorText.includes("23505") && errorText.includes("sku");
}
