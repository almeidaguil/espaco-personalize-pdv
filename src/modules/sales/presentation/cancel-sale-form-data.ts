export type CancelSaleFormData = {
  confirmCancellation: boolean;
  saleId: string;
};

export function parseCancelSaleFormData(
  formData: FormData,
): CancelSaleFormData {
  return {
    confirmCancellation: formData.get("confirmCancellation") === "on",
    saleId: String(formData.get("saleId") ?? ""),
  };
}
