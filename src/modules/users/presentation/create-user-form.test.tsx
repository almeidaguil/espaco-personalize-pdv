import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateUserForm } from "./create-user-form";

const actionState = vi.hoisted(() => ({ current: {} }));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: () => [actionState.current, vi.fn(), false],
  };
});

describe("CreateUserForm", () => {
  beforeEach(() => {
    actionState.current = {};
  });

  it("renders user creation fields", () => {
    render(<CreateUserForm action={vi.fn()} />);

    expect(screen.getByLabelText("Nome completo")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha temporaria")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar operador" }),
    ).toBeInTheDocument();
  });

  it("associates validation errors with user fields", () => {
    actionState.current = {
      fieldErrors: {
        email: "Informe um e-mail valido.",
        fullName: "Informe o nome completo.",
        temporaryPassword: "Informe uma senha temporaria.",
      },
    };

    render(<CreateUserForm action={vi.fn()} />);

    for (const [label, errorId] of [
      ["Nome completo", "fullName-error"],
      ["E-mail", "email-error"],
      ["Senha temporaria", "temporaryPassword-error"],
    ]) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveAttribute("aria-describedby", errorId);
      expect(field).toHaveAttribute("aria-invalid", "true");
    }
  });
});
