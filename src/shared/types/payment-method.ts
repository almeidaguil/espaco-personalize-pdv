export const paymentMethods = [
  "cash",
  "pix",
  "credit_card",
  "debit_card",
] as const;

export const installmentCounts = [1, 2, 3] as const;

export type PaymentMethod = (typeof paymentMethods)[number];
export type InstallmentCount = (typeof installmentCounts)[number];
