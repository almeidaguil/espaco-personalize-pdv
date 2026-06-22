import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ManagedUsersList } from "./managed-users-list";

const actionStates = vi.hoisted(() => new Map());

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: (action: unknown) => [
      actionStates.get(action) ?? {},
      vi.fn(),
      false,
    ],
  };
});

describe("ManagedUsersList", () => {
  it("associates a password validation error with its field", () => {
    const accessAction = vi.fn();
    const passwordAction = vi.fn();
    const roleAction = vi.fn();
    actionStates.set(passwordAction, {
      fieldErrors: {
        temporaryPassword: "Informe uma senha temporaria valida.",
      },
    });

    render(
      <ManagedUsersList
        accessAction={accessAction}
        currentAdminId="admin-1"
        passwordAction={passwordAction}
        roleAction={roleAction}
        users={[
          {
            createdAt: new Date("2026-01-01T12:00:00Z"),
            email: "operador@example.com",
            fullName: "Operador",
            id: "user-1",
            isActive: true,
            lastSignInAt: null,
            role: "operator",
          },
        ]}
      />,
    );

    const password = screen.getByLabelText("Senha temporaria");
    expect(password).toHaveAttribute(
      "aria-describedby",
      "temporary-password-error-user-1",
    );
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Informe uma senha temporaria valida."),
    ).toHaveAttribute("id", "temporary-password-error-user-1");
  });
});
