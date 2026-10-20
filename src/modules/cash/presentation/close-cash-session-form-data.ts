import type { CloseCashSessionUseCaseInput } from "../application/cash-session-validation";
import { parseBrlCurrencyInput } from "./open-cash-session-form-data";

export function parseCloseCashSessionFormData(
  formData: FormData,
): CloseCashSessionUseCaseInput {
  const adminPassword = getTrimmedString(formData, "adminPassword");

  return {
    ...(adminPassword ? { adminPassword } : {}),
    cashSessionId: getTrimmedString(formData, "cashSessionId"),
    reconciliations: [
      reconciliation(formData, "cash"),
      reconciliation(formData, "pix"),
      reconciliation(formData, "credit_card"),
      reconciliation(formData, "debit_card"),
    ],
  };
}

function reconciliation(
  formData: FormData,
  method: "cash" | "credit_card" | "debit_card" | "pix",
) {
  return {
    countedAmountInCents:
      parseBrlCurrencyInput(
        getTrimmedString(formData, `countedAmount_${method}`),
      ) * 100,
    method,
  };
}

function getTrimmedString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}
