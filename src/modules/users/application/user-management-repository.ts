import type { UserRole } from "@/modules/auth/domain/profile";

import type { ManagedUser } from "../domain/managed-user";

export type CreateManagedUserInput = {
  email: string;
  fullName: string;
  temporaryPassword: string;
};

export type UpdateManagedUserRoleInput = {
  currentAdminId: string;
  role: UserRole;
  userId: string;
};

export type SetManagedUserAccessInput = {
  currentAdminId: string;
  isActive: boolean;
  userId: string;
};

export type UserManagementResult =
  | {
      success: true;
    }
  | {
      error: "forbidden" | "unknown";
      success: false;
    };

export type ListManagedUsersResult =
  | {
      success: true;
      users: ManagedUser[];
    }
  | {
      error: "unknown";
      success: false;
    };

export type UserManagementRepository = {
  create(input: CreateManagedUserInput): Promise<UserManagementResult>;
  list(): Promise<ListManagedUsersResult>;
  setAccess(input: SetManagedUserAccessInput): Promise<UserManagementResult>;
  updateRole(input: UpdateManagedUserRoleInput): Promise<UserManagementResult>;
};
