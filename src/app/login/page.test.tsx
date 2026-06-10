import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("@/modules/auth/presentation/login-action", () => ({
  loginAction: vi.fn(),
}));

vi.mock("@/modules/auth/presentation/login-form", () => ({
  LoginForm: () => <form aria-label="Formulario de login" />,
}));

describe("LoginPage", () => {
  it("renders the login page shell", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("heading", { name: "Acessar PDV" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Formulario de login")).toBeInTheDocument();
  });
});
