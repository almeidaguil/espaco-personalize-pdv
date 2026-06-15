import type { Payment, SaleItem, SaleStatus } from "../domain/sale";

export type SaleDetail = {
  cashSessionId: string;
  completedAt: Date;
  eventId: string;
  eventName: string;
  id: string;
  items: SaleItem[];
  payment: Payment;
  status: SaleStatus;
  totalInReais: number;
};

export type GetSaleDetailResult =
  | {
      sale: SaleDetail;
      success: true;
    }
  | {
      error: "not_found" | "unknown";
      success: false;
    };

export type SaleDetailRepository = {
  findById(id: string): Promise<GetSaleDetailResult>;
};
