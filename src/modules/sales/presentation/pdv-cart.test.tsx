import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PdvCart } from "./pdv-cart";

describe("PdvCart", () => {
  it("adds products and updates the preview total", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
            sku: "CHAVEIRO-001",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.click(
      screen.getByRole("button", {
        name: "Adicionar uma unidade de Chaveiro Polvo",
      }),
    );

    expect(screen.getByText("2 x R$ 15,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
  });

  it("removes products from the cart", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.click(
      screen.getByRole("button", {
        name: "Remover uma unidade de Chaveiro Polvo",
      }),
    );

    expect(screen.getByText("Nenhum item adicionado.")).toBeInTheDocument();
    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
  });

  it("renders an empty products state", () => {
    render(<PdvCart products={[]} />);

    expect(
      screen.getByText("Nenhum produto ativo disponivel para venda."),
    ).toBeInTheDocument();
  });
});
