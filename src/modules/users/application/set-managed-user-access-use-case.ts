import type { UserManagementRepository } from "./user-management-repository";

export type SetManagedUserAccessUseCaseInput = {
  currentAdminId: string;
  isActive: boolean;
  userId: string;
};

export async function setManagedUserAccessUseCase(
  input: SetManagedUserAccessUseCaseInput,
  userManagementRepository: UserManagementRepository,
) {
  if (input.currentAdminId === input.userId && !input.isActive) {
    return {
      error: "forbidden" as const,
      success: false as const,
    };
  }

  return userManagementRepository.setAccess(input);
}
