import { describe, expect, it } from "vitest";

import { parseCreateEventFormData } from "./event-form-data";

describe("parseCreateEventFormData", () => {
  it("parses event form data into use case input", () => {
    const formData = new FormData();
    formData.set("name", " Evento Julho ");
    formData.set("location", " Centro de Eventos ");
    formData.set("startsAt", "2026-07-10T09:00");
    formData.set("endsAt", "2026-07-10T18:00");
    formData.set("isActive", "true");

    const result = parseCreateEventFormData(formData);

    expect(result).toEqual({
      endsAt: new Date("2026-07-10T18:00"),
      isActive: true,
      location: "Centro de Eventos",
      name: "Evento Julho",
      startsAt: new Date("2026-07-10T09:00"),
    });
  });

  it("maps empty optional fields to null and default active state to true", () => {
    const formData = new FormData();
    formData.set("name", "Evento Julho");
    formData.set("location", " ");
    formData.set("startsAt", "2026-07-10T09:00");
    formData.set("endsAt", "");

    const result = parseCreateEventFormData(formData);

    expect(result.endsAt).toBeNull();
    expect(result.isActive).toBe(true);
    expect(result.location).toBeNull();
  });

  it("supports inactive events when the form sends false only", () => {
    const formData = new FormData();
    formData.set("isActive", "false");

    expect(parseCreateEventFormData(formData).isActive).toBe(false);
  });
});
