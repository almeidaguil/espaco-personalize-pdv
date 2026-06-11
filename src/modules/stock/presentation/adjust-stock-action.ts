"use server";

import { randomUUID } from "node:crypto";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

import {
  SupabaseStockMovementRepository,
  type SupabaseStockMovementClient,
} from "../infra/supabase-stock-movement-repository";
import { adjustStockActionService } from "./adjust-stock-action-service";
import type { StockAdjustmentActionState } from "./stock-adjustment-action-state";

export async function adjustStockAction(
  previousState: StockAdjustmentActionState,
  formData: FormData,
): Promise<StockAdjustmentActionState> {
  const supabaseClient = await createSupabaseServerClient();
  const currentUserProfileClient =
    supabaseClient as unknown as SupabaseCurrentUserProfileClient;
  const stockMovementClient =
    supabaseClient as unknown as SupabaseStockMovementClient;

  return adjustStockActionService(previousState, formData, {
    currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
      currentUserProfileClient,
    ),
    generateStockMovementId: randomUUID,
    getCurrentDate: () => new Date(),
    stockMovementRepository: new SupabaseStockMovementRepository(
      stockMovementClient,
    ),
  });
}
