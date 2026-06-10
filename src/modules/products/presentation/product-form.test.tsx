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
});
