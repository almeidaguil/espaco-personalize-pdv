import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpenCashSessionForm } from "./open-cash-session-form";

const actionState = vi.hoisted(() => ({ current: {} }));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: () => [actionState.current, vi.fn(), false],
  };
});

describe("OpenCashSessionForm", () => {
  beforeEach(() => {
    actionState.current = {};
  });

  it("renders cash opening fields and submit button", () => {
    render(<OpenCashSessionForm action={vi.fn()} />);

    expect(screen.getByLabelText("Valor inicial")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir caixa" }),
    ).toBeInTheDocument();
  });

  it("associates validation errors with cash opening fields", () => {
    actionState.current = {
      fieldErrors: {
        openingAmountInReais: "Informe um valor inicial valido.",
      },
    };

    render(<OpenCashSessionForm action={vi.fn()} />);

    expect(screen.getByLabelText("Valor inicial")).toHaveAttribute(
      "aria-describedby",
      "openingAmountInReais-error",
    );

    expect(screen.getByLabelText("Valor inicial")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
