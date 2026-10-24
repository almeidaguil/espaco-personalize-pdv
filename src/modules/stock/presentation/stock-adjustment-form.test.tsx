import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StockAdjustmentForm } from "./stock-adjustment-form";

const products = [
  {
    id: "product-1",
    name: "Camiseta Preta",
    sku: "CAM-001",
    quantityOnHand: 10,
  },
];
async function selectProduct() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Buscar produto"), "camiseta");
  await user.click(
    screen.getByRole("option", { name: "Camiseta Preta — CAM-001" }),
  );
  return user;
}

describe("StockAdjustmentForm", () => {
  it.each([
    ["remove", "2", "Novo saldo: 1 unidade", true],
    ["add", "2", "Novo saldo: 5 unidades", true],
    ["remove", "3", "Novo saldo: 0 unidades", true],
    ["remove", "4", "Novo saldo: —", false],
  ])(
    "previews %s %s from three units",
    async (direction, quantity, preview, allowed) => {
      render(
        <StockAdjustmentForm
          action={vi.fn()}
          products={[{ ...products[0], quantityOnHand: 3 }]}
        />,
      );
      const user = await selectProduct();
      if (direction === "remove")
        await user.click(screen.getByRole("radio", { name: /Remover/ }));
      await user.type(screen.getByLabelText("Quantidade"), quantity);
      expect(
        screen.getByRole("status", { name: "Novo saldo" }).textContent,
      ).toBe(preview);
      const submit = screen.getByRole("button", {
        name:
          direction === "remove"
            ? "Remover do estoque"
            : "Adicionar ao estoque",
      });
      if (allowed) expect(submit).toBeEnabled();
      else {
        expect(submit).toBeDisabled();
        expect(
          screen.getByText(
            "Não é possível remover 4 unidades. O estoque atual é de 3 unidades.",
          ),
        ).toBeInTheDocument();
      }
    },
  );

  it("shows add/remove controls and requires product and positive quantity", async () => {
    render(<StockAdjustmentForm action={vi.fn()} products={products} />);
    expect(screen.getByRole("radio", { name: /Adicionar/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Remover/ })).not.toBeChecked();
    const submit = screen.getByRole("button", { name: "Adicionar ao estoque" });
    expect(submit).toBeDisabled();
    const user = await selectProduct();
    expect(
      screen.getByRole("status", { name: "Estoque atual" }),
    ).toHaveTextContent("Estoque atual: 10 unidades");
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Quantidade"), "5");
    expect(submit).toBeEnabled();
    expect(screen.getByLabelText("Quantidade")).toHaveAttribute(
      "inputmode",
      "numeric",
    );
  });

  it.each([
    ["add", "5", "15", "5"],
    ["remove", "3", "7", "-3"],
    ["remove", "10", "0", "-10"],
  ])(
    "previews and submits %s %s as a manual movement",
    async (direction, quantity, balance, signed) => {
      const action = vi
        .fn()
        .mockResolvedValue({ successMessage: "Estoque ajustado com sucesso." });
      const { rerender } = render(
        <StockAdjustmentForm action={action} products={products} />,
      );
      const user = await selectProduct();
      if (direction === "remove")
        await user.click(screen.getByRole("radio", { name: /Remover/ }));
      await user.type(screen.getByLabelText("Quantidade"), quantity);
      expect(
        screen.getByRole("status", { name: "Novo saldo" }),
      ).toHaveTextContent(`Novo saldo: ${balance} unidades`);
      await user.click(
        screen.getByRole("button", {
          name:
            direction === "remove"
              ? "Remover do estoque"
              : "Adicionar ao estoque",
        }),
      );
      expect(
        await screen.findByText("Estoque ajustado com sucesso."),
      ).toBeInTheDocument();
      const submitted = action.mock.calls[0][1] as FormData;
      expect(submitted.get("quantity")).toBe(signed);
      expect(submitted.get("type")).toBe("manual_adjustment");
      expect(submitted.get("productId")).toBe("product-1");
      expect(screen.getByLabelText("Quantidade")).toHaveValue("");
      rerender(
        <StockAdjustmentForm
          action={action}
          products={[{ ...products[0], quantityOnHand: Number(balance) }]}
        />,
      );
      expect(
        screen.getByRole("status", { name: "Estoque atual" }),
      ).toHaveTextContent(`Estoque atual: ${balance} unidades`);
    },
  );

  it.each(["0", "-3", "1.5", "abc", "1e2", " "])(
    "rejects invalid quantity %s",
    async (value) => {
      const action = vi.fn();
      render(<StockAdjustmentForm action={action} products={products} />);
      const user = await selectProduct();
      await user.type(screen.getByLabelText("Quantidade"), value);
      expect(screen.getByLabelText("Quantidade")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(
        screen.getByText("Informe uma quantidade inteira maior que zero."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Adicionar ao estoque" }),
      ).toBeDisabled();
      expect(action).not.toHaveBeenCalled();
    },
  );

  it("rejects removal beyond available stock with a clear message", async () => {
    const action = vi.fn();
    render(<StockAdjustmentForm action={action} products={products} />);
    const user = await selectProduct();
    await user.click(screen.getByRole("radio", { name: /Remover/ }));
    await user.type(screen.getByLabelText("Quantidade"), "11");
    expect(
      screen.getByText(
        "Não é possível remover 11 unidades. O estoque atual é de 10 unidades.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remover do estoque" }),
    ).toBeDisabled();
    expect(action).not.toHaveBeenCalled();
  });

  it("keeps server rejection visible without claiming success", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ formError: "Estoque nao pode ficar negativo." });
    render(<StockAdjustmentForm action={action} products={products} />);
    const user = await selectProduct();
    await user.click(screen.getByRole("radio", { name: /Remover/ }));
    await user.type(screen.getByLabelText("Quantidade"), "3");
    await user.click(
      screen.getByRole("button", { name: "Remover do estoque" }),
    );
    expect(
      await screen.findByText("Estoque nao pode ficar negativo."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade")).toHaveValue("3");
  });

  it("disables submit without active products", () => {
    render(<StockAdjustmentForm action={vi.fn()} products={[]} />);
    expect(
      screen.getByRole("button", { name: "Adicionar ao estoque" }),
    ).toBeDisabled();
  });
});
