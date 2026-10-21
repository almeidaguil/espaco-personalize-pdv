import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductForm } from "./product-form";

const actionState = vi.hoisted(() => ({
  current: {},
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: () => [actionState.current, vi.fn(), false],
  };
});

describe("ProductForm", () => {
  it("shows initial stock only when enabled and associates its error", () => {
    actionState.current = {
      fieldErrors: { initialStockQuantity: "Informe uma quantidade inteira." },
      values: {
        name: "Camiseta",
        priceInReais: "35,00",
        sku: "",
        isActive: true,
        initialStockQuantity: "-1",
      },
    };
    render(<ProductForm action={vi.fn()} allowInitialStock />);
    expect(screen.getByLabelText("Quantidade inicial em estoque")).toHaveValue(
      -1,
    );
    expect(
      screen.getByLabelText("Quantidade inicial em estoque"),
    ).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByLabelText("Quantidade inicial em estoque"),
    ).toHaveAccessibleDescription(/Informe uma quantidade inteira/);
  });
  beforeEach(() => {
    actionState.current = {};
  });

  it("renders product creation fields and submit button", () => {
    render(<ProductForm action={vi.fn()} />);

    expect(screen.getByLabelText("Nome do produto")).toBeInTheDocument();

    expect(screen.getByLabelText("Preço")).toBeInTheDocument();

    expect(screen.getByLabelText("SKU")).toBeInTheDocument();

    expect(
      screen.getByRole("checkbox", {
        name: /Produto ativo/i,
      }),
    ).toBeChecked();

    expect(
      screen.getByRole("button", {
        name: "Salvar produto",
      }),
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
    expect(
      screen.queryByLabelText("Quantidade inicial em estoque"),
    ).not.toBeInTheDocument();

    expect(screen.getByDisplayValue("42,50")).toBeInTheDocument();

    expect(screen.getByDisplayValue("CANECA-002")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Salvar alteracoes",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("checkbox", {
        name: /Produto ativo/i,
      }),
    ).not.toBeChecked();
  });

  it("associates validation errors with their fields", () => {
    actionState.current = {
      fieldErrors: {
        name: "Informe o nome do produto.",
        priceInReais: "Informe um preco valido.",
        sku: "Informe o SKU.",
      },
    };

    render(<ProductForm action={vi.fn()} />);

    expect(screen.getByLabelText("Nome do produto")).toHaveAttribute(
      "aria-describedby",
      "name-error",
    );

    expect(screen.getByLabelText("Nome do produto")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    expect(screen.getByText("Informe o nome do produto.")).toHaveAttribute(
      "id",
      "name-error",
    );

    expect(
      screen.getByRole("textbox", {
        name: /^Pre/,
      }),
    ).toHaveAttribute("aria-describedby", "priceInReais-error");

    expect(screen.getByLabelText("SKU")).toHaveAttribute(
      "aria-describedby",
      "sku-error",
    );
  });
});
