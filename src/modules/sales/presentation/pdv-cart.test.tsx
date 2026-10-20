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
            priceInCents: 1500,
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

    expect(screen.getByText("Subtotal").parentElement).toHaveTextContent(
      "R$ 30,00",
    );
    expect(screen.getByText("Total da venda").parentElement).toHaveTextContent(
      "R$ 30,00",
    );
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
            priceInCents: 1500,
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

    expect(screen.getByText("Subtotal").parentElement).toHaveTextContent(
      "R$ 0,00",
    );
    expect(screen.getByText("Total da venda").parentElement).toHaveTextContent(
      "R$ 0,00",
    );
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
            priceInCents: 1500,
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

    expect(screen.getByText("Troco").parentElement).toHaveTextContent(
      "R$ 5,00",
    );

    expect(
      screen.getByRole("button", {
        name: "Finalizar venda",
      }),
    ).toBeEnabled();
  });

  it("applies a BRL discount and recalculates the exact non-cash payment", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInCents: 1500,
            quantityOnHand: 5,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.type(screen.getByLabelText("Desconto (R$)"), "0,01");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Forma de pagamento 1" }),
      "pix",
    );

    expect(screen.getByText("Subtotal").parentElement).toHaveTextContent(
      "R$ 15,00",
    );
    expect(screen.getByText("Desconto").parentElement).toHaveTextContent(
      "R$ 0,01",
    );
    expect(screen.getByText("Total da venda").parentElement).toHaveTextContent(
      "R$ 14,99",
    );
    expect(screen.getByDisplayValue("14,99")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Finalizar venda" }),
    ).toBeEnabled();
  });

  it("accepts the maximum valid discount and rejects a discount equal to the subtotal", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInCents: 1500,
            quantityOnHand: 5,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    const discountInput = screen.getByLabelText("Desconto (R$)");
    await user.type(discountInput, "14,99");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Forma de pagamento 1" }),
      "pix",
    );

    expect(screen.getByDisplayValue("0,01")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Finalizar venda" }),
    ).toBeEnabled();

    await user.clear(discountInput);
    await user.type(discountInput, "15,00");

    expect(
      screen.getByText("O desconto deve ser menor que o subtotal."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Finalizar venda" }),
    ).toBeDisabled();
  });

  it("rejects malformed and negative discounts without rounding", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInCents: 1500,
            quantityOnHand: 5,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    const discountInput = screen.getByLabelText("Desconto (R$)");
    await user.type(discountInput, "-0,01");

    expect(discountInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText(/Informe um desconto válido em reais/),
    ).toBeInTheDocument();

    await user.clear(discountInput);
    await user.type(discountInput, "1,001");
    expect(
      screen.getByRole("button", { name: "Finalizar venda" }),
    ).toBeDisabled();
  });

  it("recalculates total and cash difference when cart quantities change", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInCents: 1500,
            quantityOnHand: 5,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.type(screen.getByLabelText("Desconto (R$)"), "5,00");
    await user.type(screen.getByLabelText("Valor recebido"), "20,00");
    expect(screen.getByText("Troco").parentElement).toHaveTextContent(
      "R$ 10,00",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar uma unidade de Chaveiro Polvo",
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Falta informar R$ 5,00.",
    );
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
            priceInCents: 1500,
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

    expect(screen.getByText("Troco").parentElement).toHaveTextContent(
      "R$ 35,00",
    );
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
            priceInCents: 1500,
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

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Falta informar R$ 5,00.",
    );
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
            priceInCents: 1500,
            quantityOnHand: 5,
            sku: "CHAVEIRO-001",
          },
          {
            id: "product-2",
            name: "Caneca Personalizada",
            priceInCents: 3500,
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
          priceInCents: (10 + index) * 100,
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
            priceInCents: 1500,
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

    await user.click(screen.getByRole("button", { name: "Dividir pagamento" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Forma de pagamento 2" }),
      "credit_card",
    );
    await user.type(screen.getByLabelText("Valor do pagamento 1"), "10,00");
    await user.type(screen.getByLabelText("Valor do pagamento 2"), "5,00");
    await user.click(screen.getByRole("radio", { name: "3x" }));

    await user.click(
      screen.getByRole("button", {
        name: "Finalizar venda",
      }),
    );

    expect(action).toHaveBeenCalled();

    const formData = action.mock.calls[0]?.[1] as FormData;

    expect(formData.has("cashSessionId")).toBe(false);

    expect(formData.has("eventId")).toBe(false);

    expect(formData.has("amountReceivedInReais")).toBe(false);

    expect(formData.get("discountInReais")).toBe("");

    expect(formData.has("paymentMethod")).toBe(false);

    expect(formData.get("paymentsJson")).toBe(
      JSON.stringify([
        { amountInReais: "10,00", method: "cash" },
        {
          amountInReais: "5,00",
          installmentCount: 3,
          method: "credit_card",
        },
      ]),
    );

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

    const action = createAction();

    render(
      <PdvCart
        action={action}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInCents: 1500,
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

    await user.type(screen.getByLabelText("Desconto (R$)"), "5,00");

    await user.click(screen.getByRole("button", { name: "Dividir pagamento" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Forma de pagamento 2" }),
      "credit_card",
    );
    await user.type(screen.getByLabelText("Valor do pagamento 1"), "5,00");
    await user.type(screen.getByLabelText("Valor do pagamento 2"), "5,00");
    await user.click(screen.getByRole("radio", { name: "3x" }));

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

    expect(screen.getByLabelText("Valor recebido")).toHaveValue("");

    expect(screen.getByLabelText("Desconto (R$)")).toHaveValue("");

    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(
      screen.getByRole("combobox", { name: "Forma de pagamento 1" }),
    ).toHaveValue("cash");
    expect(screen.queryByRole("radio", { name: "3x" })).not.toBeInTheDocument();

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
            priceInCents: 1500,
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

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Forma de pagamento 1" }),
      "pix",
    );

    expect(screen.getByDisplayValue("15,00")).toBeInTheDocument();

    expect(
      screen.getByRole("combobox", { name: "Forma de pagamento 1" }),
    ).toHaveValue("pix");

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
            priceInCents: 1500,
            quantityOnHand: 0,
          },
          {
            id: "product-2",
            name: "Produto limitado",
            priceInCents: 2000,
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
