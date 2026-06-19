export type CancelSaleInput = {
  adminPassword?: string;
  canceledAt: Date;
  saleId: string;
};

export type CancelSaleResult =
  | {
      success: true;
    }
  | {
      error: "admin_password_required" | "unknown";
      success: false;
    };

export type SaleCancellationRepository = {
  cancel(input: CancelSaleInput): Promise<CancelSaleResult>;
};
