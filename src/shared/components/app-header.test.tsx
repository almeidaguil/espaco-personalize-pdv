import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppHeader } from "./app-header";

describe("AppHeader", () => {
  it("renders sales navigation by default", () => {
    render(<AppHeader title="PDV" />);

    expect(screen.getByRole("link", { name: "Vendas" })).toHaveAttribute(
      "href",
      "/sales",
    );
    expect(
      screen.queryByRole("link", { name: "Configuracoes" }),
    ).not.toBeInTheDocument();
  });

  it("renders settings navigation when admin navigation is enabled", () => {
    render(<AppHeader showAdminNavigation title="PDV" />);

    expect(screen.getByRole("link", { name: "Configuracoes" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });
});
