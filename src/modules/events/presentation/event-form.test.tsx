import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EventForm } from "./event-form";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: () => [{}, vi.fn(), false],
  };
});

describe("EventForm", () => {
  it("renders event creation fields and submit button", () => {
    render(<EventForm action={vi.fn()} />);

    expect(screen.getByLabelText("Nome do evento")).toBeInTheDocument();
    expect(screen.getByLabelText("Local")).toBeInTheDocument();
    expect(screen.getByLabelText("Inicio")).toBeInTheDocument();
    expect(screen.getByLabelText("Termino")).toBeInTheDocument();
    expect(screen.getByLabelText("Evento ativo")).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Salvar evento" }),
    ).toBeInTheDocument();
  });
});
