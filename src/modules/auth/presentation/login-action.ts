"use server";

import { redirect } from "next/navigation";

import { authenticateWithPasswordUseCase } from "../application/authenticate-with-password-use-case";
import { SupabaseAuthRepository } from "../infra/supabase-auth-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";
import type { LoginActionState } from "./login-action-state";

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const supabaseClient = await createSupabaseServerClient();
  const authRepository = new SupabaseAuthRepository(supabaseClient);

  const result = await authenticateWithPasswordUseCase(
    {
      email: formData.get("email"),
      password: formData.get("password"),
    },
    authRepository,
  );

  if (!result.success) {
    return {
      fieldErrors: result.fieldErrors,
      formError: result.formError,
    };
  }

  redirect("/");
}
