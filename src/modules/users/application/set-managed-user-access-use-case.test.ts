import { describe, expect, it } from "vitest";

import { setManagedUserAccessUseCase } from "./set-managed-user-access-use-case";
import type {
  ListManagedUsersResult,
  UserManagementRepository,
  UserManagementResult,
} from "./user-management-repository";

class FakeUserManagementRepository implements UserManagementRepository {
  public receivedIsActive?: boolean;

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

  async setAccess(input: { isActive: boolean }): Promise<UserManagementResult> {
    this.receivedIsActive = input.isActive;

    return {
      success: true,
    };
  }

  async updateRole(): Promise<UserManagementResult> {
    return {
      success: true,
    };
  }
}

describe("setManagedUserAccessUseCase", () => {
  it("prevents the current admin from disabling itself", async () => {
    const repository = new FakeUserManagementRepository();

    await expect(
      setManagedUserAccessUseCase(
        {
          currentAdminId: "user-1",
          isActive: false,
          userId: "user-1",
        },
        repository,
      ),
    ).resolves.toEqual({
      error: "forbidden",
      success: false,
    });
    expect(repository.receivedIsActive).toBeUndefined();
  });

  it("allows admins to enable other users", async () => {
    const repository = new FakeUserManagementRepository();

    await expect(
      setManagedUserAccessUseCase(
        {
          currentAdminId: "admin-1",
          isActive: true,
          userId: "user-1",
        },
        repository,
      ),
    ).resolves.toEqual({
      success: true,
    });
    expect(repository.receivedIsActive).toBe(true);
  });
});
