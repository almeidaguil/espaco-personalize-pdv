import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldError } from "./field-error";

describe("FieldError", () => {
  it("renders an identifiable alert for an invalid field", () => {
    render(<FieldError id="name-error">Informe o nome.</FieldError>);

    expect(screen.getByRole("alert")).toHaveAttribute("id", "name-error");
    expect(screen.getByRole("alert")).toHaveClass("text-red-700");
  });
});
