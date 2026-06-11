import type { CloseCashSessionUseCaseInput } from "../application/cash-session-validation";

export function parseCloseCashSessionFormData(
  formData: FormData,
): CloseCashSessionUseCaseInput {
  return {
    cashSessionId: getTrimmedString(formData, "cashSessionId"),
  };
}

function getTrimmedString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}
