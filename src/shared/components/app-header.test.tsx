import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "./app-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/modules/auth/presentation/logout-action", () => ({
  logoutAction: vi.fn(),
}));

describe("AppHeader", () => {
  it("does not offer removed event routes in navigation", () => {
    render(<AppHeader title="PDV" />);

    expect(
      screen.queryByRole("link", { name: "Eventos" }),
    ).not.toBeInTheDocument();
  });

  it("renders sales navigation by default", () => {
    render(<AppHeader title="PDV" />);

    expect(
      screen.getByRole("link", {
        name: "Vendas",
      }),
    ).toHaveAttribute("href", "/sales");

    expect(
      screen.queryByRole("link", {
        name: "Configurações",
      }),
    ).not.toBeInTheDocument();

    expect(screen.getByText("Mais opções")).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Produtos",
      }),
    ).toHaveAttribute("href", "/products");
  });

  it("renders settings navigation when admin navigation is enabled", () => {
    render(<AppHeader showAdminNavigation title="PDV" />);

    expect(
      screen.getByRole("link", {
        name: "Configurações",
      }),
    ).toHaveAttribute("href", "/settings");
  });
});
