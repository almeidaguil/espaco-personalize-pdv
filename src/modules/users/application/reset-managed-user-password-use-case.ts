import type { UserManagementRepository } from "./user-management-repository";

export type ResetManagedUserPasswordUseCaseInput = {
  temporaryPassword: string;
  userId: string;
};

export async function resetManagedUserPasswordUseCase(
  input: ResetManagedUserPasswordUseCaseInput,
  userManagementRepository: UserManagementRepository,
) {
  return userManagementRepository.resetPassword(input);
}
