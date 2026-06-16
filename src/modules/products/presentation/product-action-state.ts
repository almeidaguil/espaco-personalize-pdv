export type ProductFormValues = {
  isActive: boolean;
  name: string;
  priceInReais: string;
  sku: string;
};

export type ProductActionState = {
  fieldErrors?: Partial<Record<"name" | "priceInReais" | "sku", string>>;
  formError?: string;
  successMessage?: string;
  values?: ProductFormValues;
};
