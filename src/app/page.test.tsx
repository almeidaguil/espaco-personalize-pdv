import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renders the initial PDV shell", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "PDV" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Vendas hoje")).toBeInTheDocument();
    expect(screen.getByText("Produtos")).toBeInTheDocument();
    expect(screen.getByText("Fechado")).toBeInTheDocument();
  });
});
