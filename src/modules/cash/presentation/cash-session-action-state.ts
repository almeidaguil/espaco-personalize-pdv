export type CashSessionActionState = {
  fieldErrors?: Partial<
    Record<
      | "cashSessionId"
      | "countedAmountInReais"
      | "eventId"
      | "openingAmountInReais",
      string
    >
  >;
  formError?: string;
  successMessage?: string;
};
