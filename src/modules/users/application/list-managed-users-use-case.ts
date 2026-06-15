import type { UserManagementRepository } from "./user-management-repository";

export async function listManagedUsersUseCase(
  userManagementRepository: UserManagementRepository,
) {
  return userManagementRepository.list();
}
