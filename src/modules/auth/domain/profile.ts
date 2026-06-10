export const userRoles = ["admin", "operator"] as const;

export type UserRole = (typeof userRoles)[number];

export type Profile = {
  createdAt: Date;
  email: string;
  fullName: string | null;
  id: string;
  role: UserRole;
  updatedAt: Date;
};

export function isUserRole(value: string): value is UserRole {
  return userRoles.includes(value as UserRole);
}
