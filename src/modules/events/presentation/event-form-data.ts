import type { CreateEventUseCaseInput } from "../application/event-validation";

export function parseCreateEventFormData(
  formData: FormData,
): CreateEventUseCaseInput {
  return {
    endsAt: parseOptionalDate(formData.get("endsAt")),
    isActive: parseOptionalBoolean(formData.getAll("isActive")),
    location: getOptionalTrimmedString(formData, "location"),
    name: getTrimmedString(formData, "name"),
    startsAt: parseRequiredDate(formData.get("startsAt")),
  };
}

function getTrimmedString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalTrimmedString(
  formData: FormData,
  key: string,
): string | null {
  const value = getTrimmedString(formData, key);

  return value ? value : null;
}

function parseOptionalBoolean(values: FormDataEntryValue[]): boolean {
  if (values.length === 0) {
    return true;
  }

  return values.some((value) => value === "true");
}

function parseRequiredDate(value: FormDataEntryValue | null): Date {
  if (typeof value !== "string" || !value.trim()) {
    return new Date("invalid");
  }

  return new Date(value);
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return new Date(value);
}
