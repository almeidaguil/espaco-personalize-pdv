import type { User } from "@supabase/supabase-js";

import { isUserRole, type UserRole } from "@/modules/auth/domain/profile";

import type { ManagedUser } from "../domain/managed-user";
import type {
  CreateManagedUserInput,
  ListManagedUsersResult,
  SetManagedUserAccessInput,
  UpdateManagedUserRoleInput,
  UserManagementRepository,
  UserManagementResult,
} from "../application/user-management-repository";

type SupabaseError = {
  message?: string;
};

type SupabaseProfileRow = {
  email: string;
  full_name: string | null;
  id: string;
  role: string;
};

export type SupabaseUserManagementClient = {
  auth: {
    admin: {
      createUser(input: {
        email: string;
        email_confirm: boolean;
        password: string;
        user_metadata: {
          full_name: string;
        };
      }): PromiseLike<{
        data: {
          user: User | null;
        };
        error: SupabaseError | null;
      }>;
      listUsers(input: { page: number; perPage: number }): PromiseLike<{
        data: {
          users: User[];
        };
        error: SupabaseError | null;
      }>;
      updateUserById(
        userId: string,
        attributes: {
          ban_duration?: string;
        },
      ): PromiseLike<{
        data: {
          user: User | null;
        };
        error: SupabaseError | null;
      }>;
    };
  };
  from(table: "profiles"): {
    select(columns: "id,email,full_name,role"): PromiseLike<{
      data: SupabaseProfileRow[] | null;
      error: SupabaseError | null;
    }>;
    update(payload: { email?: string; full_name?: string; role?: UserRole }): {
      eq(
        column: "id",
        value: string,
      ): PromiseLike<{
        data: unknown;
        error: SupabaseError | null;
      }>;
    };
  };
};

const disabledBanDuration = "876000h";

export class SupabaseUserManagementRepository implements UserManagementRepository {
  constructor(private readonly supabaseClient: SupabaseUserManagementClient) {}

  async create(input: CreateManagedUserInput): Promise<UserManagementResult> {
    const { data: userData, error: userError } =
      await this.supabaseClient.auth.admin.createUser({
        email: input.email,
        email_confirm: true,
        password: input.temporaryPassword,
        user_metadata: {
          full_name: input.fullName,
        },
      });

    if (userError || !userData.user) {
      return {
        error: "unknown",
        success: false,
      };
    }

    const { error: profileError } = await this.supabaseClient
      .from("profiles")
      .update({
        email: input.email,
        full_name: input.fullName,
        role: "operator",
      })
      .eq("id", userData.user.id);

    if (profileError) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      success: true,
    };
  }

  async list(): Promise<ListManagedUsersResult> {
    const [{ data: usersData, error: usersError }, profilesResult] =
      await Promise.all([
        this.supabaseClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        }),
        this.supabaseClient.from("profiles").select("id,email,full_name,role"),
      ]);

    if (usersError || profilesResult.error) {
      return {
        error: "unknown",
        success: false,
      };
    }

    const profilesById = new Map(
      (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
    );

    return {
      success: true,
      users: usersData.users
        .map((user) => toManagedUser(user, profilesById.get(user.id)))
        .filter((user): user is ManagedUser => user !== null)
        .sort((first, second) => first.email.localeCompare(second.email)),
    };
  }

  async setAccess(
    input: SetManagedUserAccessInput,
  ): Promise<UserManagementResult> {
    if (input.currentAdminId === input.userId && !input.isActive) {
      return {
        error: "forbidden",
        success: false,
      };
    }

    const { error } = await this.supabaseClient.auth.admin.updateUserById(
      input.userId,
      {
        ban_duration: input.isActive ? "none" : disabledBanDuration,
      },
    );

    if (error) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      success: true,
    };
  }

  async updateRole(
    input: UpdateManagedUserRoleInput,
  ): Promise<UserManagementResult> {
    if (input.currentAdminId === input.userId && input.role !== "admin") {
      return {
        error: "forbidden",
        success: false,
      };
    }

    const { error } = await this.supabaseClient
      .from("profiles")
      .update({
        role: input.role,
      })
      .eq("id", input.userId);

    if (error) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      success: true,
    };
  }
}

function toManagedUser(
  user: User,
  profile: SupabaseProfileRow | undefined,
): ManagedUser | null {
  if (!profile || !isUserRole(profile.role)) {
    return null;
  }

  return {
    createdAt: new Date(user.created_at),
    email: profile.email || user.email || "",
    fullName: profile.full_name,
    id: user.id,
    isActive: !user.banned_until || new Date(user.banned_until) <= new Date(),
    lastSignInAt: user.last_sign_in_at ? new Date(user.last_sign_in_at) : null,
    role: profile.role,
  };
}
