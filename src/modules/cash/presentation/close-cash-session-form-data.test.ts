import { describe, expect, it } from "vitest";

import { parseCloseCashSessionFormData } from "./close-cash-session-form-data";

describe("parseCloseCashSessionFormData", () => {
  it("parses and trims the selected cash session", () => {
    const formData = new FormData();
    formData.set("cashSessionId", " cash-session-1 ");

    expect(parseCloseCashSessionFormData(formData)).toEqual({
      cashSessionId: "cash-session-1",
    });
  });

  it("returns an empty cash session id when the field is missing", () => {
    expect(parseCloseCashSessionFormData(new FormData())).toEqual({
      cashSessionId: "",
    });
  });
});
