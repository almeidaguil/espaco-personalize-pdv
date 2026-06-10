import type { LoginInput } from "../application/login-validation";

export function parseLoginFormData(formData: FormData): LoginInput {
  return {
    email: getTrimmedString(formData, "email"),
    password: getTrimmedString(formData, "password"),
  };
}

function getTrimmedString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}
