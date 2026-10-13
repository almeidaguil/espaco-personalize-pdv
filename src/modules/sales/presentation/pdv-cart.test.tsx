import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PdvCart } from "./pdv-cart";
import type { SaleActionState } from "./sale-action-state";

describe("PdvCart", () => {
  it("adds products and updates the preview total", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
            quantityOnHand: 5,
            sku: "CHAVEIRO-001",
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar uma unidade de Chaveiro Polvo",
      }),
    );
    expect(screen.getByText("2 × R$ 15,00")).toBeInTheDocument();

    expect(screen.getAllByText("R$ 30,00")).toHaveLength(2);
  });

  it("removes products from the cart", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
            quantityOnHand: 5,
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Remover uma unidade de Chaveiro Polvo",
      }),
    );

    expect(screen.getByText("Nenhum item adicionado.")).toBeInTheDocument();

    expect(screen.getAllByText("R$ 0,00")).toHaveLength(2);
  });

  it("calculates cash change when received amount covers the total", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
            quantityOnHand: 5,
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar",
      }),
    );

    await user.type(screen.getByLabelText("Valor recebido"), "20,00");

    expect(screen.getByText("Troco R$ 5,00")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Finalizar venda",
      }),
    ).toBeEnabled();
  });

  it("fills received amount from cash shortcuts", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
            quantityOnHand: 5,
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Valor exato",
      }),
    );

    expect(screen.getByDisplayValue("15,00")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /R\$\s*50,00/,
      }),
    );

    expect(screen.getByDisplayValue("50,00")).toBeInTheDocument();

    expect(screen.getByText("Troco R$ 35,00")).toBeInTheDocument();
  });

  it("shows the missing amount when cash payment is insufficient", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
            quantityOnHand: 5,
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar",
      }),
    );

    await user.type(screen.getByLabelText("Valor recebido"), "10,00");

    expect(screen.getByText("Falta R$ 5,00")).toBeInTheDocument();
  });

  it("filters products by name and SKU", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
            quantityOnHand: 5,
            sku: "CHAVEIRO-001",
          },
          {
            id: "product-2",
            name: "Caneca Personalizada",
            priceInReais: 35,
            quantityOnHand: 5,
            sku: "CANECA-001",
          },
        ]}
      />,
    );

    await user.type(screen.getByLabelText("Buscar produto"), "caneca");

    expect(screen.getByText("Caneca Personalizada")).toBeInTheDocument();

    expect(screen.queryByText("Chaveiro Polvo")).not.toBeInTheDocument();

    expect(screen.getByText("1 produto(s) encontrado(s)")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Buscar produto"));

    await user.type(screen.getByLabelText("Buscar produto"), "chaveiro-001");

    expect(screen.getByText("Chaveiro Polvo")).toBeInTheDocument();

    expect(screen.queryByText("Caneca Personalizada")).not.toBeInTheDocument();
  });

  it("paginates products for faster scanning", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={Array.from({ length: 9 }, (_, index) => ({
          id: `product-${index + 1}`,
          name: `Produto ${index + 1}`,
          priceInReais: 10 + index,
          quantityOnHand: 5,
          sku: `SKU-${index + 1}`,
        }))}
      />,
    );

    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();

    expect(screen.getByText("Produto 1")).toBeInTheDocument();

    expect(screen.queryByText("Produto 9")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Próxima",
      }),
    );

    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();

    expect(screen.getByText("Produto 9")).toBeInTheDocument();

    expect(screen.queryByText("Produto 1")).not.toBeInTheDocument();
  });

  it("renders an empty products state", () => {
    render(<PdvCart action={createAction()} products={[]} />);

    expect(
      screen.getByText("Nenhum produto ativo disponível para venda."),
    ).toBeInTheDocument();
  });

  it("submits the sale intent to the server action", async () => {
    const user = userEvent.setup();
    const action = createAction();

    render(
      <PdvCart
        action={action}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
            quantityOnHand: 5,
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar",
      }),
    );

    await user.type(screen.getByLabelText("Valor recebido"), "20,00");

    await user.click(
      screen.getByRole("button", {
        name: "Finalizar venda",
      }),
    );

    expect(action).toHaveBeenCalled();

    const formData = action.mock.calls[0]?.[1] as FormData;

    expect(formData.has("cashSessionId")).toBe(false);

    expect(formData.has("eventId")).toBe(false);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    expect(formData.get("amountReceivedInReais")).toBe("20,00");

    expect(formData.get("paymentMethod")).toBe("cash");

    expect(formData.get("itemsJson")).toBe(
      JSON.stringify([
        {
          productId: "product-1",
          quantity: 1,
        },
      ]),
    );
  });

  it("clears the cart and payment after a successful sale", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
            quantityOnHand: 5,
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Pix",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Finalizar venda",
      }),
    );

    expect(
      await screen.findByText("Venda finalizada com sucesso."),
    ).toBeInTheDocument();

    expect(screen.getByText("Nenhum item adicionado.")).toBeInTheDocument();

    expect(screen.queryByText("1 × R$ 15,00")).not.toBeInTheDocument();

    expect(screen.getByLabelText("Valor recebido")).toHaveAttribute(
      "name",
      "amountReceivedInReais",
    );

    expect(screen.getByLabelText("Valor recebido")).toHaveValue("");

    expect(
      screen.getByRole("button", {
        name: "Dinheiro",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(
      screen.getByRole("button", {
        name: "Finalizar venda",
      }),
    ).toBeDisabled();
  });

  it("supports non-cash payment methods", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
            quantityOnHand: 5,
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Pix",
      }),
    );

    expect(screen.getByDisplayValue("15,00")).toBeInTheDocument();

    expect(screen.getByText("Pix no valor de R$ 15,00")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Pix",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(
      screen.getByRole("button", {
        name: "Finalizar venda",
      }),
    ).toBeEnabled();
  });

  it("blocks products without stock and stops at the stock limit", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Produto sem estoque",
            priceInReais: 15,
            quantityOnHand: 0,
          },
          {
            id: "product-2",
            name: "Produto limitado",
            priceInReais: 20,
            quantityOnHand: 2,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Sem estoque",
      }),
    ).toBeDisabled();

    await user.click(
      screen.getAllByRole("button", {
        name: "Adicionar",
      })[0]!,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar uma unidade de Produto limitado",
      }),
    );

    expect(screen.getByText("2 × R$ 20,00")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Limite no carrinho",
      }),
    ).toBeDisabled();
  });
});

function createAction() {
  return vi.fn(
    async (
      _previousState: SaleActionState,
      _formData: FormData,
    ): Promise<SaleActionState> => {
      void _previousState;
      void _formData;

      return {
        successMessage: "Venda finalizada com sucesso.",
      };
    },
  );
}
