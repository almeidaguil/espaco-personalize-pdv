export function parseCloseEventFormData(formData: FormData): string {
  const value = formData.get("eventId");

  return typeof value === "string" ? value.trim() : "";
}
