import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductList } from "./product-list";

describe("ProductList", () => {
  it("renders product summary cards", () => {
    render(
      <ProductList
        products={[
          {
            id: "product-1",
            isActive: true,
            name: "Caneca personalizada",
            priceLabel: "R$ 35,00",
            sku: "CANECA-001",
          },
          {
            id: "product-2",
            isActive: false,
            name: "Chaveiro",
            priceLabel: "R$ 12,00",
            sku: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("Caneca personalizada")).toBeInTheDocument();
    expect(screen.getByText("CANECA-001")).toBeInTheDocument();
    expect(screen.getByText("R$ 35,00")).toBeInTheDocument();
    expect(screen.getByText("Chaveiro")).toBeInTheDocument();
    expect(screen.getByText("Sem SKU")).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });
});
