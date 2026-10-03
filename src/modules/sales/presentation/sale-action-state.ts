export type SaleActionState = {
  fieldErrors?: Partial<Record<"cashSessionId" | "items" | "payment", string>>;
  formError?: string;
  successMessage?: string;
};
