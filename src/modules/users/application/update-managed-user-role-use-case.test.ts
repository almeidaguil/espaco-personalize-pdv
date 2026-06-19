import { describe, expect, it } from "vitest";

import { updateManagedUserRoleUseCase } from "./update-managed-user-role-use-case";
import type {
  ListManagedUsersResult,
  UserManagementRepository,
  UserManagementResult,
} from "./user-management-repository";

class FakeUserManagementRepository implements UserManagementRepository {
  public receivedRole?: string;

  async create(): Promise<UserManagementResult> {
    return {
      success: true,
    };
  }

  async list(): Promise<ListManagedUsersResult> {
    return {
      success: true,
      users: [],
    };
  }

  async resetPassword(): Promise<UserManagementResult> {
    return {
      success: true,
    };
  }

  async setAccess(): Promise<UserManagementResult> {
    return {
      success: true,
    };
  }

  async updateRole(input: { role: string }): Promise<UserManagementResult> {
    this.receivedRole = input.role;

    return {
      success: true,
    };
  }
}

describe("updateManagedUserRoleUseCase", () => {
  it("prevents the current admin from demoting itself", async () => {
    const repository = new FakeUserManagementRepository();

    await expect(
      updateManagedUserRoleUseCase(
        {
          currentAdminId: "user-1",
          role: "operator",
          userId: "user-1",
        },
        repository,
      ),
    ).resolves.toEqual({
      error: "forbidden",
      success: false,
    });
    expect(repository.receivedRole).toBeUndefined();
  });

  it("allows admins to promote other users", async () => {
    const repository = new FakeUserManagementRepository();

    await expect(
      updateManagedUserRoleUseCase(
        {
          currentAdminId: "admin-1",
          role: "admin",
          userId: "user-1",
        },
        repository,
      ),
    ).resolves.toEqual({
      success: true,
    });
    expect(repository.receivedRole).toBe("admin");
  });
});
