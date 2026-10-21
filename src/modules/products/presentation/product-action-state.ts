export type ProductFormValues = {
  initialStockQuantity?: string;
  isActive: boolean;
  name: string;
  priceInReais: string;
  sku: string;
};

export type ProductActionState = {
  fieldErrors?: Partial<
    Record<"name" | "priceInReais" | "sku" | "initialStockQuantity", string>
  >;
  formError?: string;
  successMessage?: string;
  values?: ProductFormValues;
};
