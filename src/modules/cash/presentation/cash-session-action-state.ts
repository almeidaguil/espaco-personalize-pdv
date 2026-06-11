export type CashSessionActionState = {
  fieldErrors?: Partial<
    Record<"cashSessionId" | "eventId" | "openingAmountInReais", string>
  >;
  formError?: string;
  successMessage?: string;
};
