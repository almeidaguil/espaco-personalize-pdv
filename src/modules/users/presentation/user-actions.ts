"use server";

import { revalidatePath } from "next/cache";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { requireAdminUseCase } from "@/modules/auth/application/require-admin-use-case";
import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin-client";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

import { createManagedUserUseCase } from "../application/create-managed-user-use-case";
import { resetManagedUserPasswordUseCase } from "../application/reset-managed-user-password-use-case";
import { setManagedUserAccessUseCase } from "../application/set-managed-user-access-use-case";
import { updateManagedUserRoleUseCase } from "../application/update-managed-user-role-use-case";
import {
  SupabaseUserManagementRepository,
  type SupabaseUserManagementClient,
} from "../infra/supabase-user-management-repository";
import type { UserActionState } from "./user-action-state";
import {
  parseCreateUserFormData,
  parseResetUserPasswordFormData,
  parseSetUserAccessFormData,
  parseUpdateUserRoleFormData,
} from "./user-form-data";

export async function createManagedUserAction(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const context = await createUserActionContext();

  if (!context.success) {
    return {
      formError: context.formError,
    };
  }

  const parsed = parseCreateUserFormData(formData);

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const result = await createManagedUserUseCase(
    parsed.data,
    context.repository,
  );

  if (!result.success) {
    return {
      formError: "Nao foi possivel criar o usuario.",
    };
  }

  revalidatePath("/settings");

  return {
    successMessage: "Usuario criado como operador.",
  };
}

export async function updateManagedUserRoleAction(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const context = await createUserActionContext();

  if (!context.success) {
    return {
      formError: context.formError,
    };
  }

  const parsed = parseUpdateUserRoleFormData(formData);

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const result = await updateManagedUserRoleUseCase(
    {
      currentAdminId: context.currentAdminId,
      role: parsed.data.role,
      userId: parsed.data.userId,
    },
    context.repository,
  );

  if (!result.success) {
    return {
      formError:
        result.error === "forbidden"
          ? "Voce nao pode remover seu proprio acesso admin."
          : "Nao foi possivel alterar o perfil do usuario.",
    };
  }

  revalidatePath("/settings");

  return {
    successMessage: "Perfil atualizado.",
  };
}

export async function setManagedUserAccessAction(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const context = await createUserActionContext();

  if (!context.success) {
    return {
      formError: context.formError,
    };
  }

  const parsed = parseSetUserAccessFormData(formData);

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const result = await setManagedUserAccessUseCase(
    {
      currentAdminId: context.currentAdminId,
      isActive: parsed.data.isActive,
      userId: parsed.data.userId,
    },
    context.repository,
  );

  if (!result.success) {
    return {
      formError:
        result.error === "forbidden"
          ? "Voce nao pode desativar seu proprio usuario."
          : "Nao foi possivel atualizar o acesso do usuario.",
    };
  }

  revalidatePath("/settings");

  return {
    successMessage: parsed.data.isActive
      ? "Usuario ativado."
      : "Usuario desativado.",
  };
}

export async function resetManagedUserPasswordAction(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const context = await createUserActionContext();

  if (!context.success) {
    return {
      formError: context.formError,
    };
  }

  const parsed = parseResetUserPasswordFormData(formData);

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const result = await resetManagedUserPasswordUseCase(
    parsed.data,
    context.repository,
  );

  if (!result.success) {
    return {
      formError: "Nao foi possivel redefinir a senha do usuario.",
    };
  }

  revalidatePath("/settings");

  return {
    successMessage: "Senha temporaria definida.",
  };
}

function toFieldErrors(
  errors: Record<string, string[] | undefined>,
): UserActionState["fieldErrors"] {
  return Object.fromEntries(
    Object.entries(errors)
      .map(([field, messages]) => [field, messages?.[0]])
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
  );
}

async function createUserActionContext(): Promise<
  | {
      currentAdminId: string;
      repository: SupabaseUserManagementRepository;
      success: true;
    }
  | {
      formError: string;
      success: false;
    }
> {
  const supabaseClient = await createSupabaseServerClient();
  const currentUserProfileRepository = new SupabaseCurrentUserProfileRepository(
    supabaseClient as unknown as SupabaseCurrentUserProfileClient,
  );
  const adminResult = await requireAdminUseCase(currentUserProfileRepository);

  if (!adminResult.success) {
    return {
      formError: adminResult.formError,
      success: false,
    };
  }

  const currentUserResult = await currentUserProfileRepository.getCurrent();

  if (!currentUserResult.success) {
    return {
      formError: "Nao foi possivel verificar seu usuario.",
      success: false,
    };
  }

  return {
    currentAdminId: currentUserResult.profile.id,
    repository: new SupabaseUserManagementRepository(
      createSupabaseAdminClient() as unknown as SupabaseUserManagementClient,
    ),
    success: true,
  };
}
