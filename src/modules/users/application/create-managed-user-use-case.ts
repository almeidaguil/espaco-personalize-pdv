import type { UserManagementRepository } from "./user-management-repository";

export type CreateManagedUserUseCaseInput = {
  email: string;
  fullName: string;
  temporaryPassword: string;
};

export async function createManagedUserUseCase(
  input: CreateManagedUserUseCaseInput,
  userManagementRepository: UserManagementRepository,
) {
  return userManagementRepository.create(input);
}
