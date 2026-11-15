import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductForm } from "./product-form";
import { getProductFormValues } from "./product-form-data";

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
  it.each([undefined, null, ""])(
    "renders an optional empty description for %s",
    (description) => {
      render(
        <ProductForm
          action={vi.fn()}
          initialValues={{
            description,
            name: "Camisa",
            priceInReais: "129,90",
            sku: "CAM-001",
            isActive: true,
          }}
        />,
      );
      const field = screen.getByRole("textbox", { name: "Descrição" });
      expect(field).toHaveValue("");
      expect(field).not.toBeRequired();
      expect(field).toHaveAccessibleDescription("Opcional.");
      expect(screen.queryByText(/undefined|null/)).not.toBeInTheDocument();
    },
  );

  it("allows keyboard editing and clearing an existing description", async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        action={vi.fn()}
        initialValues={{
          description: "Algodão",
          name: "Camisa",
          priceInReais: "129,90",
          sku: "CAM-001",
          isActive: true,
        }}
      />,
    );
    const field = screen.getByRole("textbox", { name: "Descrição" });
    expect(field).toHaveValue("Algodão");
    await user.tab();
    expect(screen.getByLabelText("Nome do produto")).toHaveFocus();
    await user.tab();
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, "Descrição atualizada");
    expect(field).toHaveValue("Descrição atualizada");
    await user.clear(field);
    expect(new FormData(field.closest("form")!).get("description")).toBe("");
  });

  it("preserves a long multiline description when other fields fail validation", () => {
    const description = `Camisa em algodão.\n${"Detalhes ".repeat(500)}${"x".repeat(500)}`;
    const data = new FormData();
    data.set("description", description);
    data.set("name", "Camisa");
    data.set("priceInReais", "inválido");
    actionState.current = {
      values: getProductFormValues(data),
      fieldErrors: { priceInReais: "Informe um preço válido." },
    };
    render(<ProductForm action={vi.fn()} />);
    expect(screen.getByLabelText("Descrição")).toHaveValue(description);
    expect(screen.getByLabelText("Nome do produto")).toHaveValue("Camisa");
    expect(screen.getByLabelText("Preço")).toHaveValue("inválido");
  });
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
    expect(screen.getByLabelText("Descrição")).toHaveValue("");

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
