import type {
  SaveStockMovementResult,
  StockMovementRepository,
} from "../application/stock-movement-repository";
import type {
  StockMovement,
  StockMovementType,
} from "../domain/stock-movement";

type SupabaseStockMovementRow = {
  created_at: string;
  id: string;
  product_id: string;
  quantity_change: number;
  type: StockMovementType;
};

type SupabaseStockMovementInsert = {
  created_at: string;
  id: string;
  product_id: string;
  quantity_change: number;
  type: StockMovementType;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SupabaseSingleStockMovementResult = PromiseLike<{
  data: SupabaseStockMovementRow | null;
  error: SupabaseError | null;
}>;

type SupabaseStockMovementListResult = PromiseLike<{
  data: SupabaseStockMovementRow[] | null;
  error: SupabaseError | null;
}>;

export type SupabaseStockMovementClient = {
  from(table: "stock_movements"): {
    insert(payload: SupabaseStockMovementInsert): {
      select(columns: string): {
        single(): SupabaseSingleStockMovementResult;
      };
    };
    select(columns: string): {
      eq(
        column: "product_id",
        value: string,
      ): {
        order(
          column: "created_at",
          options: { ascending: true },
        ): SupabaseStockMovementListResult;
      };
    };
  };
};

const stockMovementColumns =
  "id,product_id,type,quantity_change,created_at" as const;

export class SupabaseStockMovementRepository implements StockMovementRepository {
  constructor(private readonly supabaseClient: SupabaseStockMovementClient) {}

  async listByProductId(productId: string): Promise<StockMovement[]> {
    const { data, error } = await this.supabaseClient
      .from("stock_movements")
      .select(stockMovementColumns)
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(toStockMovement);
  }

  async save(movement: StockMovement): Promise<SaveStockMovementResult> {
    const { data, error } = await this.supabaseClient
      .from("stock_movements")
      .insert(toStockMovementInsert(movement))
      .select(stockMovementColumns)
      .single();

    if (error || !data) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      movement: toStockMovement(data),
      success: true,
    };
  }
}

function toStockMovementInsert(
  movement: StockMovement,
): SupabaseStockMovementInsert {
  return {
    created_at: movement.createdAt.toISOString(),
    id: movement.id,
    product_id: movement.productId,
    quantity_change: movement.quantityChange,
    type: movement.type,
  };
}

function toStockMovement(row: SupabaseStockMovementRow): StockMovement {
  return {
    createdAt: new Date(row.created_at),
    id: row.id,
    productId: row.product_id,
    quantityChange: row.quantity_change,
    type: row.type,
  };
}
