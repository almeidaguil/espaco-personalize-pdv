import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NewProductPage from "./page";

vi.mock("@/modules/products/presentation/create-product-action", () => ({
  createProductAction: vi.fn(),
}));

vi.mock("@/modules/products/presentation/product-form", () => ({
  ProductForm: () => <form aria-label="Formulario de produto" />,
}));

describe("NewProductPage", () => {
  it("renders the product creation page", () => {
    render(<NewProductPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Novo produto" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Produtos")).toBeInTheDocument();
    expect(screen.getByLabelText("Formulario de produto")).toBeInTheDocument();
  });
});
