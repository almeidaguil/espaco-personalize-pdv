export type ProductActionState = {
  fieldErrors?: Partial<Record<"name" | "priceInReais" | "sku", string>>;
  formError?: string;
  successMessage?: string;
};
