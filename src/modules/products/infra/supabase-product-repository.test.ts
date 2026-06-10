import { describe, expect, it } from "vitest";

import { Money } from "../domain/money";
import type { Product } from "../domain/product";
import { SupabaseProductRepository } from "./supabase-product-repository";

type FakeSupabaseResponse = {
  data: FakeSupabaseProductRow | null;
  error: {
    code?: string;
    details?: string;
    message?: string;
  } | null;
};

type FakeSupabaseProductRow = {
  id: string;
  is_active: boolean;
  name: string;
  price_in_cents: number;
  sku: string | null;
};

class FakeSupabaseProductClient {
  public insertedPayload?: unknown;
  public orderedColumn?: string;
  public orderOptions?: unknown;
  public selectedColumns?: string;

  constructor(
    private readonly response: FakeSupabaseResponse,
    private readonly listResponse: {
      data: FakeSupabaseProductRow[] | null;
      error: FakeSupabaseResponse["error"];
    } = { data: [], error: null },
  ) {}

  from(table: "products") {
    expect(table).toBe("products");

    return {
      insert: (payload: unknown) => {
        this.insertedPayload = payload;

        return {
          select: (columns: string) => {
            this.selectedColumns = columns;

            return {
              single: async () => this.response,
            };
          },
        };
      },
      select: (columns: string) => {
        this.selectedColumns = columns;

        return {
          order: (column: "name", options: { ascending: true }) => {
            this.orderedColumn = column;
            this.orderOptions = options;

            return Promise.resolve(this.listResponse);
          },
        };
      },
    };
  }
}

describe("SupabaseProductRepository", () => {
  it("saves a product mapping BRL money to persisted cents", async () => {
    const supabaseClient = new FakeSupabaseProductClient({
      data: {
        id: "product-1",
        is_active: true,
        name: "Caneca personalizada",
        price_in_cents: 3500,
        sku: "CANECA-001",
      },
      error: null,
    });
    const repository = new SupabaseProductRepository(supabaseClient);
    const product: Product = {
      id: "product-1",
      isActive: true,
      name: "Caneca personalizada",
      price: Money.fromReais(35),
      sku: "CANECA-001",
    };

    const result = await repository.save(product);

    expect(supabaseClient.insertedPayload).toEqual({
      id: "product-1",
      is_active: true,
      name: "Caneca personalizada",
      price_in_cents: 3500,
      sku: "CANECA-001",
    });
    expect(supabaseClient.selectedColumns).toBe(
      "id,name,sku,price_in_cents,is_active",
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.product.price.toReais()).toBe(35);
      expect(result.product.price.toCents()).toBe(3500);
    }
  });

  it("maps empty SKU to null on insert and omits it from the domain product", async () => {
    const supabaseClient = new FakeSupabaseProductClient({
      data: {
        id: "product-1",
        is_active: true,
        name: "Caneca personalizada",
        price_in_cents: 3500,
        sku: null,
      },
      error: null,
    });
    const repository = new SupabaseProductRepository(supabaseClient);

    const result = await repository.save({
      id: "product-1",
      isActive: true,
      name: "Caneca personalizada",
      price: Money.fromReais(35),
    });

    expect(supabaseClient.insertedPayload).toMatchObject({
      sku: null,
    });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.product).not.toHaveProperty("sku");
    }
  });

  it("maps SKU unique violations to repository errors", async () => {
    const supabaseClient = new FakeSupabaseProductClient({
      data: null,
      error: {
        code: "23505",
        details: "Key (sku)=(CANECA-001) already exists.",
        message:
          'duplicate key value violates unique constraint "products_sku_unique_idx"',
      },
    });
    const repository = new SupabaseProductRepository(supabaseClient);

    const result = await repository.save({
      id: "product-1",
      isActive: true,
      name: "Caneca personalizada",
      price: Money.fromReais(35),
      sku: "CANECA-001",
    });

    expect(result).toEqual({
      error: "sku_already_exists",
      success: false,
    });
  });

  it("maps SKU unique violations even when Supabase omits details", async () => {
    const supabaseClient = new FakeSupabaseProductClient({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "products_sku_unique_idx"',
      },
    });
    const repository = new SupabaseProductRepository(supabaseClient);

    const result = await repository.save({
      id: "product-1",
      isActive: true,
      name: "Caneca personalizada",
      price: Money.fromReais(35),
      sku: "CANECA-001",
    });

    expect(result).toEqual({
      error: "sku_already_exists",
      success: false,
    });
  });

  it("maps unknown Supabase errors", async () => {
    const supabaseClient = new FakeSupabaseProductClient({
      data: null,
      error: {
        code: "PGRST000",
        message: "Unexpected error",
      },
    });
    const repository = new SupabaseProductRepository(supabaseClient);

    const result = await repository.save({
      id: "product-1",
      isActive: true,
      name: "Caneca personalizada",
      price: Money.fromReais(35),
    });

    expect(result).toEqual({
      error: "unknown",
      success: false,
    });
  });

  it("lists products ordered by name mapping persisted cents to BRL money", async () => {
    const supabaseClient = new FakeSupabaseProductClient(
      { data: null, error: null },
      {
        data: [
          {
            id: "product-1",
            is_active: true,
            name: "Caneca personalizada",
            price_in_cents: 3500,
            sku: "CANECA-001",
          },
          {
            id: "product-2",
            is_active: false,
            name: "Chaveiro",
            price_in_cents: 1200,
            sku: null,
          },
        ],
        error: null,
      },
    );
    const repository = new SupabaseProductRepository(supabaseClient);

    const result = await repository.list();

    expect(supabaseClient.selectedColumns).toBe(
      "id,name,sku,price_in_cents,is_active",
    );
    expect(supabaseClient.orderedColumn).toBe("name");
    expect(supabaseClient.orderOptions).toEqual({ ascending: true });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.products).toHaveLength(2);
      expect(result.products[0]?.price.toReais()).toBe(35);
      expect(result.products[1]).not.toHaveProperty("sku");
      expect(result.products[1]?.isActive).toBe(false);
    }
  });

  it("maps list errors to unknown repository errors", async () => {
    const supabaseClient = new FakeSupabaseProductClient(
      { data: null, error: null },
      {
        data: null,
        error: {
          code: "PGRST000",
          message: "Unexpected error",
        },
      },
    );
    const repository = new SupabaseProductRepository(supabaseClient);

    await expect(repository.list()).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });
});
