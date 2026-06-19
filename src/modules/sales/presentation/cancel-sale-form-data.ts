export type CancelSaleFormData = {
  adminPassword?: string;
  confirmCancellation: boolean;
  saleId: string;
};

export function parseCancelSaleFormData(
  formData: FormData,
): CancelSaleFormData {
  const adminPassword = String(formData.get("adminPassword") ?? "").trim();

  return {
    ...(adminPassword ? { adminPassword } : {}),
    confirmCancellation: formData.get("confirmCancellation") === "on",
    saleId: String(formData.get("saleId") ?? ""),
  };
}
