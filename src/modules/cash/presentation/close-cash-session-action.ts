"use server";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

import {
  SupabaseCashSessionRepository,
  type SupabaseCashSessionClient,
} from "../infra/supabase-cash-session-repository";
import type { CashSessionActionState } from "./cash-session-action-state";
import { closeCashSessionActionService } from "./close-cash-session-action-service";

export async function closeCashSessionAction(
  previousState: CashSessionActionState,
  formData: FormData,
): Promise<CashSessionActionState> {
  const supabaseClient = await createSupabaseServerClient();
  const currentUserProfileClient =
    supabaseClient as unknown as SupabaseCurrentUserProfileClient;
  const cashSessionClient =
    supabaseClient as unknown as SupabaseCashSessionClient;

  return closeCashSessionActionService(previousState, formData, {
    cashSessionRepository: new SupabaseCashSessionRepository(cashSessionClient),
    currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
      currentUserProfileClient,
    ),
    getCurrentDate: () => new Date(),
  });
}
