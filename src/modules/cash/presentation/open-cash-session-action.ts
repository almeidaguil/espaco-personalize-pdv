"use server";

import { randomUUID } from "node:crypto";

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
import { openCashSessionActionService } from "./open-cash-session-action-service";

export async function openCashSessionAction(
  previousState: CashSessionActionState,
  formData: FormData,
): Promise<CashSessionActionState> {
  const supabaseClient = await createSupabaseServerClient();
  const currentUserProfileClient =
    supabaseClient as unknown as SupabaseCurrentUserProfileClient;
  const cashSessionClient =
    supabaseClient as unknown as SupabaseCashSessionClient;

  return openCashSessionActionService(previousState, formData, {
    cashSessionRepository: new SupabaseCashSessionRepository(cashSessionClient),
    currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
      currentUserProfileClient,
    ),
    generateCashSessionId: randomUUID,
    getCurrentDate: () => new Date(),
  });
}
