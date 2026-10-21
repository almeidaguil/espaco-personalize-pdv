export type CashSessionActionState = {
  fieldErrors?: Partial<
    Record<
      | "cashSessionId"
      | "countedAmountInReais"
      | "openingAmountInReais"
      | "reconciliations",
      string
    >
  >;
  formError?: string;
  successMessage?: string;
};
