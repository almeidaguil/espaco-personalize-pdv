import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OpenCashSessionForm } from "./open-cash-session-form";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: () => [{}, vi.fn(), false],
  };
});

describe("OpenCashSessionForm", () => {
  it("renders cash opening fields and submit button", () => {
    render(
      <OpenCashSessionForm
        action={vi.fn()}
        events={[
          {
            id: "event-1",
            label: "Evento Julho",
          },
        ]}
      />,
    );

    expect(screen.getByLabelText("Evento")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Evento Julho" })).toHaveValue(
      "event-1",
    );
    expect(screen.getByLabelText("Valor inicial")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir caixa" }),
    ).toBeInTheDocument();
  });
});
