import { describe, expect, it } from "vitest";

import type { StockMovement } from "../domain/stock-movement";
import { SupabaseStockMovementRepository } from "./supabase-stock-movement-repository";

type FakeStockMovementRow = {
  created_at: string;
  id: string;
  product_id: string;
  quantity_change: number;
  sale_id: string | null;
  type: "initial_adjustment" | "manual_adjustment" | "sale";
};

type FakeSupabaseResponse<TData> = {
  data: TData;
  error: {
    code?: string;
    message?: string;
  } | null;
};

class FakeSupabaseStockMovementClient {
  public eqColumn?: string;
  public eqValue?: string;
  public insertedPayload?: unknown;
  public orderedColumn?: string;
  public orderOptions?: unknown;
  public selectedColumns?: string;

  constructor(
    private readonly saveResponse: FakeSupabaseResponse<FakeStockMovementRow | null>,
    private readonly listResponse: FakeSupabaseResponse<
      FakeStockMovementRow[] | null
    > = {
      data: [],
      error: null,
    },
  ) {}

  from(table: "stock_movements") {
    expect(table).toBe("stock_movements");

    return {
      insert: (payload: unknown) => {
        this.insertedPayload = payload;

        return {
          select: (columns: string) => {
            this.selectedColumns = columns;

            return {
              single: async () => this.saveResponse,
            };
          },
        };
      },
      select: (columns: string) => {
        this.selectedColumns = columns;

        return {
          order: (
            columnToOrder: "created_at",
            options: { ascending: boolean },
          ) => {
            this.orderedColumn = columnToOrder;
            this.orderOptions = options;

            return Promise.resolve(this.listResponse);
          },
          eq: (column: "product_id", value: string) => {
            this.eqColumn = column;
            this.eqValue = value;

            return {
              order: (
                columnToOrder: "created_at",
                options: { ascending: true },
              ) => {
                this.orderedColumn = columnToOrder;
                this.orderOptions = options;

                return Promise.resolve(this.listResponse);
              },
            };
          },
        };
      },
    };
  }
}

describe("SupabaseStockMovementRepository", () => {
  it("saves stock movements mapping domain fields to persisted columns", async () => {
    const supabaseClient = new FakeSupabaseStockMovementClient({
      data: {
        created_at: "2026-06-10T12:00:00.000Z",
        id: "movement-1",
        product_id: "product-1",
        quantity_change: 10,
        sale_id: null,
        type: "initial_adjustment",
      },
      error: null,
    });
    const repository = new SupabaseStockMovementRepository(supabaseClient);

    const result = await repository.save(createMovement());

    expect(supabaseClient.insertedPayload).toEqual({
      created_at: "2026-06-10T12:00:00.000Z",
      id: "movement-1",
      product_id: "product-1",
      quantity_change: 10,
      sale_id: null,
      type: "initial_adjustment",
    });
    expect(supabaseClient.selectedColumns).toBe(
      "id,product_id,type,quantity_change,sale_id,created_at",
    );
    expect(result).toEqual({
      movement: createMovement(),
      success: true,
    });
  });

  it("saves sale stock movements with sale references", async () => {
    const movement = createMovement({
      quantityChange: -2,
      saleId: "sale-1",
      type: "sale",
    });
    const supabaseClient = new FakeSupabaseStockMovementClient({
      data: {
        created_at: "2026-06-10T12:00:00.000Z",
        id: "movement-1",
        product_id: "product-1",
        quantity_change: -2,
        sale_id: "sale-1",
        type: "sale",
      },
      error: null,
    });
    const repository = new SupabaseStockMovementRepository(supabaseClient);

    const result = await repository.save(movement);

    expect(supabaseClient.insertedPayload).toEqual({
      created_at: "2026-06-10T12:00:00.000Z",
      id: "movement-1",
      product_id: "product-1",
      quantity_change: -2,
      sale_id: "sale-1",
      type: "sale",
    });
    expect(result).toEqual({
      movement,
      success: true,
    });
  });

  it("maps save errors to repository errors", async () => {
    const supabaseClient = new FakeSupabaseStockMovementClient({
      data: null,
      error: {
        code: "PGRST000",
        message: "Unexpected error",
      },
    });
    const repository = new SupabaseStockMovementRepository(supabaseClient);

    await expect(repository.save(createMovement())).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });

  it("lists stock movements by product ordered by creation date", async () => {
    const supabaseClient = new FakeSupabaseStockMovementClient(
      { data: null, error: null },
      {
        data: [
          {
            created_at: "2026-06-10T12:00:00.000Z",
            id: "movement-1",
            product_id: "product-1",
            quantity_change: 10,
            sale_id: null,
            type: "initial_adjustment",
          },
        ],
        error: null,
      },
    );
    const repository = new SupabaseStockMovementRepository(supabaseClient);

    await expect(repository.listByProductId("product-1")).resolves.toEqual([
      createMovement(),
    ]);
    expect(supabaseClient.selectedColumns).toBe(
      "id,product_id,type,quantity_change,sale_id,created_at",
    );
    expect(supabaseClient.eqColumn).toBe("product_id");
    expect(supabaseClient.eqValue).toBe("product-1");
    expect(supabaseClient.orderedColumn).toBe("created_at");
    expect(supabaseClient.orderOptions).toEqual({ ascending: true });
  });

  it("lists all stock movements ordered by most recent first", async () => {
    const supabaseClient = new FakeSupabaseStockMovementClient(
      { data: null, error: null },
      {
        data: [
          {
            created_at: "2026-06-10T12:00:00.000Z",
            id: "movement-1",
            product_id: "product-1",
            quantity_change: 10,
            sale_id: null,
            type: "initial_adjustment",
          },
        ],
        error: null,
      },
    );
    const repository = new SupabaseStockMovementRepository(supabaseClient);

    await expect(repository.listAll()).resolves.toEqual([createMovement()]);
    expect(supabaseClient.selectedColumns).toBe(
      "id,product_id,type,quantity_change,sale_id,created_at",
    );
    expect(supabaseClient.orderedColumn).toBe("created_at");
    expect(supabaseClient.orderOptions).toEqual({ ascending: false });
  });

  it("returns an empty list when listing fails", async () => {
    const supabaseClient = new FakeSupabaseStockMovementClient(
      { data: null, error: null },
      {
        data: null,
        error: {
          code: "PGRST000",
          message: "Unexpected error",
        },
      },
    );
    const repository = new SupabaseStockMovementRepository(supabaseClient);

    await expect(repository.listByProductId("product-1")).resolves.toEqual([]);
  });
});

function createMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    createdAt: new Date("2026-06-10T12:00:00.000Z"),
    id: "movement-1",
    productId: "product-1",
    quantityChange: 10,
    type: "initial_adjustment",
    ...overrides,
  };
}
