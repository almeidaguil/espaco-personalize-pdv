import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StockAdjustmentForm } from "./stock-adjustment-form";

const actionState = vi.hoisted(() => ({ current: {} }));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: () => [actionState.current, vi.fn(), false],
  };
});

describe("StockAdjustmentForm", () => {
  beforeEach(() => {
    actionState.current = {};
  });

  it("renders stock adjustment fields and enabled submit button", () => {
    render(
      <StockAdjustmentForm
        action={vi.fn()}
        products={[{ id: "product-1", label: "Caneca personalizada" }]}
      />,
    );

    expect(screen.getByLabelText("Produto")).toBeInTheDocument();
    expect(screen.getByText("Caneca personalizada")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade")).toBeInTheDocument();
    expect(screen.getByLabelText(/Ajuste inicial/)).toBeChecked();
    expect(screen.getByLabelText(/Ajuste manual/)).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Registrar ajuste" }),
    ).toBeEnabled();
  });

  it("disables submit when there are no active products", () => {
    render(<StockAdjustmentForm action={vi.fn()} products={[]} />);

    expect(screen.getByText("Nenhum produto ativo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar ajuste" }),
    ).toBeDisabled();
  });

  it("associates validation errors with stock adjustment fields", () => {
    actionState.current = {
      fieldErrors: {
        productId: "Selecione um produto.",
        quantity: "Informe a quantidade.",
        type: "Selecione o tipo de ajuste.",
      },
    };

    render(
      <StockAdjustmentForm
        action={vi.fn()}
        products={[{ id: "product-1", label: "Caneca personalizada" }]}
      />,
    );

    expect(screen.getByLabelText("Produto")).toHaveAttribute(
      "aria-describedby",
      "productId-error",
    );
    expect(
      screen.getByRole("group", { name: "Tipo de ajuste" }),
    ).toHaveAttribute("aria-describedby", "type-error");
    expect(screen.getByLabelText("Quantidade")).toHaveAttribute(
      "aria-describedby",
      "quantity-error",
    );

    for (const field of [
      screen.getByLabelText("Produto"),
      screen.getByRole("group", { name: "Tipo de ajuste" }),
      screen.getByLabelText("Quantidade"),
    ]) {
      expect(field).toHaveAttribute("aria-invalid", "true");
    }
  });
});
