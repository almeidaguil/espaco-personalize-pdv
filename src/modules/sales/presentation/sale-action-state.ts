export type SaleActionState = {
  fieldErrors?: Partial<
    Record<"cashSessionId" | "discountInCents" | "items" | "payments", string>
  >;
  formError?: string;
  successMessage?: string;
};
