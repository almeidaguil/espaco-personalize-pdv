import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventForm } from "./event-form";

const actionState = vi.hoisted(() => ({ current: {} }));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: () => [actionState.current, vi.fn(), false],
  };
});

describe("EventForm", () => {
  beforeEach(() => {
    actionState.current = {};
  });

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

  it("associates validation errors with their fields", () => {
    actionState.current = {
      fieldErrors: {
        endsAt: "Informe o termino.",
        location: "Informe o local.",
        name: "Informe o nome.",
        startsAt: "Informe o inicio.",
      },
    };

    render(<EventForm action={vi.fn()} />);

    for (const [label, errorId] of [
      ["Nome do evento", "name-error"],
      ["Local", "location-error"],
      ["Inicio", "startsAt-error"],
      ["Termino", "endsAt-error"],
    ]) {
      expect(screen.getByLabelText(label)).toHaveAttribute(
        "aria-describedby",
        errorId,
      );
      expect(screen.getByLabelText(label)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    }

    expect(screen.getByText("Informe o nome.")).toHaveAttribute(
      "id",
      "name-error",
    );
  });
});
