import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StockProductCombobox } from "./stock-product-combobox";

const products = [
  { id: "product-1", name: "Calça Jeans", sku: "CALCA-001" },
  { id: "product-2", name: "Camiseta Básica", sku: "CAM-002" },
  { id: "product-3", name: "Boné" },
];

describe("StockProductCombobox", () => {
  it.each([
    ["Calça Jeans", "Calça Jeans — CALCA-001"],
    ["jeans", "Calça Jeans — CALCA-001"],
    ["CALCA", "Calça Jeans — CALCA-001"],
    ["cam-002", "Camiseta Básica — CAM-002"],
  ])("finds products for %s", async (searchTerm, expectedOption) => {
    const user = userEvent.setup();

    render(<StockProductCombobox products={products} />);

    await user.type(
      screen.getByRole("combobox", { name: "Buscar produto" }),
      searchTerm,
    );

    expect(
      screen.getByRole("option", { name: expectedOption }),
    ).toBeInTheDocument();
  });

  it("keeps productId empty until a result is explicitly selected", async () => {
    const user = userEvent.setup();
    const { container } = render(<StockProductCombobox products={products} />);

    const search = screen.getByRole("combobox", { name: "Buscar produto" });
    const productId = getProductIdInput(container);

    await user.type(search, "Camiseta");

    expect(productId).toHaveValue("");

    await user.click(
      screen.getByRole("option", { name: "Camiseta Básica — CAM-002" }),
    );

    expect(productId).toHaveValue("product-2");
    expect(search).toHaveValue("Camiseta Básica — CAM-002");
    expect(search).toHaveAttribute("readonly");

    const selectedProduct = screen.getByRole("status", {
      name: "Produto selecionado",
    });

    expect(
      within(selectedProduct).getByText("Camiseta Básica — CAM-002"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Trocar produto" }));

    expect(productId).toHaveValue("");
    expect(search).toHaveValue("");
    expect(search).not.toHaveAttribute("readonly");
    expect(search).toHaveFocus();
  });

  it("selects with the keyboard and closes results with Escape", async () => {
    const user = userEvent.setup();
    const { container } = render(<StockProductCombobox products={products} />);

    const search = screen.getByRole("combobox", { name: "Buscar produto" });

    await user.type(search, "cam");
    await user.keyboard("{ArrowDown}{ArrowDown}");

    expect(search).toHaveAttribute("aria-expanded", "true");
    expect(search).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("product-2"),
    );

    await user.keyboard("{Enter}");

    expect(getProductIdInput(container)).toHaveValue("product-2");
    expect(search).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Trocar produto" }));
    await user.type(search, "bon");
    await user.keyboard("{Escape}");

    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps arrow navigation visible in long result lists", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      const longProductList = Array.from({ length: 10 }, (_, index) => ({
        id: `product-${index + 1}`,
        name: `Produto ${index + 1}`,
        sku: `SKU-${index + 1}`,
      }));

      render(<StockProductCombobox products={longProductList} />);

      const search = screen.getByRole("combobox", { name: "Buscar produto" });

      await user.click(search);
      await user.keyboard("{ArrowDown}");

      expect(search).toHaveAttribute(
        "aria-activedescendant",
        expect.stringContaining("product-1"),
      );
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });

      await user.keyboard("{Escape}");
      await user.keyboard("{ArrowUp}");

      expect(search).toHaveAttribute(
        "aria-activedescendant",
        expect.stringContaining("product-10"),
      );
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      });
    }
  });

  it("shows an explicit empty result state", async () => {
    const user = userEvent.setup();

    render(<StockProductCombobox products={products} />);

    await user.type(
      screen.getByRole("combobox", { name: "Buscar produto" }),
      "produto inexistente",
    );

    expect(
      screen.getByText("Nenhum produto encontrado para esta busca."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("exposes disabled and validation states accessibly", () => {
    const { container } = render(
      <StockProductCombobox errorId="productId-error" invalid products={[]} />,
    );

    const search = screen.getByRole("combobox", { name: "Buscar produto" });

    expect(search).toBeDisabled();
    expect(search).toHaveAttribute("aria-invalid", "true");
    expect(search).toHaveAttribute("aria-describedby", "productId-error");
    expect(screen.getByText("Nenhum produto ativo")).toBeInTheDocument();
    expect(getProductIdInput(container)).toHaveValue("");
  });
});

function getProductIdInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[name="productId"]',
  );

  if (!input) {
    throw new Error("Expected productId hidden input.");
  }

  return input;
}
