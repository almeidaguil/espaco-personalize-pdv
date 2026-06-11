export type CashSessionActionState = {
  fieldErrors?: Partial<Record<"eventId" | "openingAmountInReais", string>>;
  formError?: string;
  successMessage?: string;
};
