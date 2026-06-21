import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InlineFeedback } from "./inline-feedback";

describe("InlineFeedback", () => {
  it("announces errors assertively", () => {
    render(<InlineFeedback tone="error">Falha ao salvar.</InlineFeedback>);

    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("alert")).toHaveClass("bg-red-50", "text-red-800");
  });

  it("announces success messages politely", () => {
    render(
      <InlineFeedback className="mt-2" tone="success">
        Salvo com sucesso.
      </InlineFeedback>,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveClass("bg-emerald-50", "mt-2");
  });
});
