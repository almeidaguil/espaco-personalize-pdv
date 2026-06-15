import type { CloseCashSessionUseCaseInput } from "../application/cash-session-validation";
import { parseBrlCurrencyInput } from "./open-cash-session-form-data";

export function parseCloseCashSessionFormData(
  formData: FormData,
): CloseCashSessionUseCaseInput {
  return {
    cashSessionId: getTrimmedString(formData, "cashSessionId"),
    countedAmountInReais: parseBrlCurrencyInput(
      getTrimmedString(formData, "countedAmountInReais"),
    ),
  };
}

function getTrimmedString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}
