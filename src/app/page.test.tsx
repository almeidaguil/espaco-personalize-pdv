import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renders the initial PDV shell", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "PDV" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Espaco Personalize" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Vendas hoje")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Produtos/ })
        .some((link) => link.getAttribute("href") === "/products"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /Estoque/ })
        .some((link) => link.getAttribute("href") === "/stock"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /PDV/ })
        .some((link) => link.getAttribute("href") === "/pdv"),
    ).toBe(true);
    expect(screen.getByText("Fechado")).toBeInTheDocument();
  });
});
