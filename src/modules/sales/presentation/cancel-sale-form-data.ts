export function parseCancelSaleFormData(formData: FormData): string {
  return String(formData.get("saleId") ?? "");
}
