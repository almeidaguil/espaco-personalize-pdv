import { isUserRole } from "../domain/profile";
import type {
  CurrentUserProfileRepository,
  GetCurrentUserProfileResult,
} from "../application/current-user-profile-repository";

type SupabaseUser = {
  id: string;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SupabaseProfileRow = {
  id: string;
  role: string;
};

export type SupabaseCurrentUserProfileClient = {
  auth: {
    getUser(): PromiseLike<{
      data: {
        user: SupabaseUser | null;
      };
      error: SupabaseError | null;
    }>;
  };
  from(table: "profiles"): {
    select(columns: "id,role"): {
      eq(
        column: "id",
        value: string,
      ): {
        single(): PromiseLike<{
          data: SupabaseProfileRow | null;
          error: SupabaseError | null;
        }>;
      };
    };
  };
};

export class SupabaseCurrentUserProfileRepository implements CurrentUserProfileRepository {
  constructor(
    private readonly supabaseClient: SupabaseCurrentUserProfileClient,
  ) {}

  async getCurrent(): Promise<GetCurrentUserProfileResult> {
    const { data: userData, error: userError } =
      await this.supabaseClient.auth.getUser();

    if (userError || !userData.user) {
      return {
        error: "unauthenticated",
        success: false,
      };
    }

    const { data: profileData, error: profileError } = await this.supabaseClient
      .from("profiles")
      .select("id,role")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profileData || !isUserRole(profileData.role)) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      profile: {
        id: profileData.id,
        role: profileData.role,
      },
      success: true,
    };
  }
}
