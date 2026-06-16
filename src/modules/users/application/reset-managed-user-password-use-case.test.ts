import { describe, expect, it } from "vitest";

import { resetManagedUserPasswordUseCase } from "./reset-managed-user-password-use-case";
import type {
  ListManagedUsersResult,
  ResetManagedUserPasswordInput,
  UpdateManagedUserRoleInput,
  UserManagementRepository,
  UserManagementResult,
} from "./user-management-repository";

class FakeUserManagementRepository implements UserManagementRepository {
  receivedInput: ResetManagedUserPasswordInput | null = null;

  create(): Promise<UserManagementResult> {
    throw new Error("Method not implemented.");
  }

  list(): Promise<ListManagedUsersResult> {
    throw new Error("Method not implemented.");
  }

  async resetPassword(
    input: ResetManagedUserPasswordInput,
  ): Promise<UserManagementResult> {
    this.receivedInput = input;

    return {
      success: true,
    };
  }

  setAccess(): Promise<UserManagementResult> {
    throw new Error("Method not implemented.");
  }

  updateRole(input: UpdateManagedUserRoleInput): Promise<UserManagementResult> {
    void input;
    throw new Error("Method not implemented.");
  }
}

describe("resetManagedUserPasswordUseCase", () => {
  it("delegates the password reset to the repository", async () => {
    const repository = new FakeUserManagementRepository();

    const result = await resetManagedUserPasswordUseCase(
      {
        temporaryPassword: "temporary123",
        userId: "38dc5fe9-feae-4083-9736-46a253727e2a",
      },
      repository,
    );

    expect(result).toEqual({ success: true });
    expect(repository.receivedInput).toEqual({
      temporaryPassword: "temporary123",
      userId: "38dc5fe9-feae-4083-9736-46a253727e2a",
    });
  });
});
