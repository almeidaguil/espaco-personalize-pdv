import type { UserRole } from "@/modules/auth/domain/profile";

export type ManagedUser = {
  createdAt: Date;
  email: string;
  fullName: string | null;
  id: string;
  isActive: boolean;
  lastSignInAt: Date | null;
  role: UserRole;
};
