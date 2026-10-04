export type CashSessionActionState = {
  fieldErrors?: Partial<
    Record<
      "cashSessionId" | "countedAmountInReais" | "openingAmountInReais",
      string
    >
  >;
  formError?: string;
  successMessage?: string;
};
