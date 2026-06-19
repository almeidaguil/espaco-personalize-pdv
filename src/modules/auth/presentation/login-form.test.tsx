import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: () => [{}, vi.fn(), false],
  };
});

describe("LoginForm", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the login fields and submit button", () => {
    render(<LoginForm action={vi.fn()} />);

    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByLabelText(/Lembrar e-mail/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();

    render(<LoginForm action={vi.fn()} />);

    const passwordInput = screen.getByLabelText("Senha");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar" }));

    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Ocultar" }));

    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("stores the remembered email before submitting", async () => {
    const user = userEvent.setup();

    render(<LoginForm action={vi.fn()} />);

    await user.type(screen.getByLabelText("E-mail"), " operador@example.com ");
    await user.click(screen.getByLabelText(/Lembrar e-mail/));
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      window.localStorage.getItem("espaco-personalize:remembered-email"),
    ).toBe("operador@example.com");
  });

  it("loads a remembered email", () => {
    window.localStorage.setItem(
      "espaco-personalize:remembered-email",
      "operador@example.com",
    );

    render(<LoginForm action={vi.fn()} />);

    expect(screen.getByLabelText("E-mail")).toHaveValue("operador@example.com");
    expect(screen.getByLabelText(/Lembrar e-mail/)).toBeChecked();
  });
});
