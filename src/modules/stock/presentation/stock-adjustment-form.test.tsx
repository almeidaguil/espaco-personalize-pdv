import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StockAdjustmentForm } from "./stock-adjustment-form";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: () => [{}, vi.fn(), false],
  };
});

describe("StockAdjustmentForm", () => {
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
});
