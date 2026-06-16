"use server";

import { revalidatePath } from "next/cache";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

import {
  SupabaseEventRepository,
  type SupabaseEventClient,
} from "../infra/supabase-event-repository";
import { closeEventActionService } from "./close-event-action-service";
import type { EventActionState } from "./event-action-state";

export async function closeEventAction(
  previousState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const supabaseClient = await createSupabaseServerClient();
  const result = await closeEventActionService(previousState, formData, {
    currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
      supabaseClient as unknown as SupabaseCurrentUserProfileClient,
    ),
    eventRepository: new SupabaseEventRepository(
      supabaseClient as unknown as SupabaseEventClient,
    ),
  });

  if (result.successMessage) {
    revalidatePath("/");
    revalidatePath("/cash/open");
    revalidatePath("/events");
    revalidatePath("/pdv");
  }

  return result;
}
