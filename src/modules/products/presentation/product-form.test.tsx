import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductForm } from "./product-form";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: () => [{}, vi.fn(), false],
  };
});

describe("ProductForm", () => {
  it("renders product creation fields and submit button", () => {
    render(<ProductForm action={vi.fn()} />);

    expect(screen.getByLabelText("Nome do produto")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço")).toBeInTheDocument();
    expect(screen.getByLabelText("SKU")).toBeInTheDocument();
    expect(screen.getByLabelText("Produto ativo")).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Salvar produto" }),
    ).toBeInTheDocument();
  });

  it("renders initial values for editing", () => {
    render(
      <ProductForm
        action={vi.fn()}
        initialValues={{
          isActive: false,
          name: "Caneca premium",
          priceInReais: "42,50",
          sku: "CANECA-002",
        }}
        submitLabel="Salvar alteracoes"
      />,
    );

    expect(screen.getByDisplayValue("Caneca premium")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42,50")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CANECA-002")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar alteracoes" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Produto ativo")).not.toBeChecked();
  });
});
