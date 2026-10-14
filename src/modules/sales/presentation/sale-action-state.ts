export type SaleActionState = {
  fieldErrors?: Partial<
    Record<"cashSessionId" | "discountInCents" | "items" | "payment", string>
  >;
  formError?: string;
  successMessage?: string;
};
