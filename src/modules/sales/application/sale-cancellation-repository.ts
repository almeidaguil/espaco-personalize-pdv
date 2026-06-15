export type CancelSaleInput = {
  canceledAt: Date;
  saleId: string;
};

export type CancelSaleResult =
  | {
      success: true;
    }
  | {
      error: "unknown";
      success: false;
    };

export type SaleCancellationRepository = {
  cancel(input: CancelSaleInput): Promise<CancelSaleResult>;
};
