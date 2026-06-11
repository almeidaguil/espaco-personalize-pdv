"use server";

import { randomUUID } from "node:crypto";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

import {
  SupabaseEventRepository,
  type SupabaseEventClient,
} from "../infra/supabase-event-repository";
import { createEventActionService } from "./create-event-action-service";
import type { EventActionState } from "./event-action-state";

export async function createEventAction(
  previousState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const supabaseClient = await createSupabaseServerClient();
  const currentUserProfileClient =
    supabaseClient as unknown as SupabaseCurrentUserProfileClient;
  const eventClient = supabaseClient as unknown as SupabaseEventClient;

  return createEventActionService(previousState, formData, {
    currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
      currentUserProfileClient,
    ),
    eventRepository: new SupabaseEventRepository(eventClient),
    generateEventId: randomUUID,
  });
}
