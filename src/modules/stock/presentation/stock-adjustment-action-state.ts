export type StockAdjustmentActionState = {
  fieldErrors?: Partial<Record<"productId" | "quantity" | "type", string>>;
  formError?: string;
  successMessage?: string;
};
