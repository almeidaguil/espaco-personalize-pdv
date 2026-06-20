import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductCatalog } from "./product-catalog";

describe("ProductCatalog", () => {
  const products = [
    {
      id: "product-1",
      isActive: true,
      name: "Caneca personalizada",
      priceLabel: "R$ 35,00",
      sku: "CANECA-001",
    },
    {
      id: "product-2",
      isActive: true,
      name: "Chaveiro polvo",
      priceLabel: "R$ 15,00",
      sku: "CHAVEIRO-001",
    },
  ];

  it("renders the search input and the full product list by default", () => {
    render(<ProductCatalog products={products} />);

    expect(screen.getByLabelText("Buscar produto")).toBeInTheDocument();
    expect(screen.getByText("2 produto(s) encontrado(s)")).toBeInTheDocument();
    expect(screen.getByText("Caneca personalizada")).toBeInTheDocument();
    expect(screen.getByText("Chaveiro polvo")).toBeInTheDocument();
  });

  it("filters products by partial name", () => {
    render(<ProductCatalog products={products} />);

    fireEvent.change(screen.getByLabelText("Buscar produto"), {
      target: { value: "polvo" },
    });

    expect(screen.getByText("1 produto(s) encontrado(s)")).toBeInTheDocument();
    expect(screen.getByText("Chaveiro polvo")).toBeInTheDocument();
    expect(screen.queryByText("Caneca personalizada")).not.toBeInTheDocument();
  });

  it("filters products by partial sku", () => {
    render(<ProductCatalog products={products} />);

    fireEvent.change(screen.getByLabelText("Buscar produto"), {
      target: { value: "cane" },
    });

    expect(screen.getByText("1 produto(s) encontrado(s)")).toBeInTheDocument();
    expect(screen.getByText("Caneca personalizada")).toBeInTheDocument();
    expect(screen.queryByText("Chaveiro polvo")).not.toBeInTheDocument();
  });

  it("shows an empty state when the search has no matches", () => {
    render(<ProductCatalog products={products} />);

    fireEvent.change(screen.getByLabelText("Buscar produto"), {
      target: { value: "inexistente" },
    });

    expect(screen.getByText("0 produto(s) encontrado(s)")).toBeInTheDocument();
    expect(
      screen.getByText("Nenhum produto encontrado para a busca informada."),
    ).toBeInTheDocument();
  });

  it("paginates product results", () => {
    render(
      <ProductCatalog
        products={Array.from({ length: 9 }, (_, index) => ({
          id: `product-${index + 1}`,
          isActive: true,
          name: `Produto ${index + 1}`,
          priceLabel: `R$ ${index + 1},00`,
          sku: `SKU-${index + 1}`,
        }))}
      />,
    );

    expect(screen.getByText("Mostrando 1-8 de 9 produtos")).toBeInTheDocument();
    expect(screen.getByText("Produto 1")).toBeInTheDocument();
    expect(screen.queryByText("Produto 9")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Proxima" }));

    expect(screen.getByText("Mostrando 9-9 de 9 produtos")).toBeInTheDocument();
    expect(screen.getByText("Produto 9")).toBeInTheDocument();
    expect(screen.queryByText("Produto 1")).not.toBeInTheDocument();
  });
});
