import type { Sale } from "../domain/sale";

export type SaveSaleResult =
  | {
      sale: Sale;
      success: true;
    }
  | {
      error: "unknown";
      success: false;
    };

export type SaleRepository = {
  save(sale: Sale): Promise<SaveSaleResult>;
};
