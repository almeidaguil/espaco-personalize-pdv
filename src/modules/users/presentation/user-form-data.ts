import { z } from "zod";

import { userRoles } from "@/modules/auth/domain/profile";

const createUserSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  fullName: z.string().trim().min(2, "Informe o nome completo."),
  temporaryPassword: z
    .string()
    .min(8, "A senha temporaria deve ter pelo menos 8 caracteres."),
});

const updateUserRoleSchema = z.object({
  role: z.enum(userRoles, {
    error: "Selecione um perfil valido.",
  }),
  userId: z.string().trim().uuid("Usuario invalido."),
});

const setUserAccessSchema = z.object({
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
  userId: z.string().trim().uuid("Usuario invalido."),
});

const resetUserPasswordSchema = z.object({
  temporaryPassword: z
    .string()
    .min(8, "A senha temporaria deve ter pelo menos 8 caracteres."),
  userId: z.string().trim().uuid("Usuario invalido."),
});

export function parseCreateUserFormData(formData: FormData) {
  return createUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    temporaryPassword: formData.get("temporaryPassword"),
  });
}

export function parseUpdateUserRoleFormData(formData: FormData) {
  return updateUserRoleSchema.safeParse({
    role: formData.get("role"),
    userId: formData.get("userId"),
  });
}

export function parseSetUserAccessFormData(formData: FormData) {
  return setUserAccessSchema.safeParse({
    isActive: formData.get("isActive"),
    userId: formData.get("userId"),
  });
}

export function parseResetUserPasswordFormData(formData: FormData) {
  return resetUserPasswordSchema.safeParse({
    temporaryPassword: formData.get("temporaryPassword"),
    userId: formData.get("userId"),
  });
}
