import type { UserRole } from "@/modules/auth/domain/profile";

import type { UserManagementRepository } from "./user-management-repository";

export type UpdateManagedUserRoleUseCaseInput = {
  currentAdminId: string;
  role: UserRole;
  userId: string;
};

export async function updateManagedUserRoleUseCase(
  input: UpdateManagedUserRoleUseCaseInput,
  userManagementRepository: UserManagementRepository,
) {
  if (input.currentAdminId === input.userId && input.role !== "admin") {
    return {
      error: "forbidden" as const,
      success: false as const,
    };
  }

  return userManagementRepository.updateRole(input);
}
