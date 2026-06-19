export type SaleActionState = {
  fieldErrors?: Partial<
    Record<"cashSessionId" | "eventId" | "items" | "payment", string>
  >;
  formError?: string;
  successMessage?: string;
};
