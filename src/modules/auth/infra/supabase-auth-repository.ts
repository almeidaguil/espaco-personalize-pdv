import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthRepository,
  SignInWithPasswordInput,
  SignInWithPasswordResult,
} from "../application/auth-repository";

export class SupabaseAuthRepository implements AuthRepository {
  constructor(private readonly supabaseClient: SupabaseClient) {}

  async signInWithPassword(
    input: SignInWithPasswordInput,
  ): Promise<SignInWithPasswordResult> {
    const { data, error } = await this.supabaseClient.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user?.email) {
      return {
        error: "E-mail ou senha invalidos.",
        success: false,
      };
    }

    return {
      session: {
        email: data.user.email,
        userId: data.user.id,
      },
      success: true,
    };
  }
}
