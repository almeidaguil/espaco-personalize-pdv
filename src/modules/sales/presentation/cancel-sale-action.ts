"use server";

import { revalidatePath } from "next/cache";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

import {
  SupabaseSaleCancellationRepository,
  type SupabaseSaleCancellationClient,
} from "../infra/supabase-sale-cancellation-repository";
import {
  SupabaseSaleDetailRepository,
  type SupabaseSaleDetailClient,
} from "../infra/supabase-sale-detail-repository";
import { cancelSaleActionService } from "./cancel-sale-action-service";
import type { CancelSaleActionState } from "./cancel-sale-action-state";
import { parseCancelSaleFormData } from "./cancel-sale-form-data";

export async function cancelSaleAction(
  previousState: CancelSaleActionState,
  formData: FormData,
): Promise<CancelSaleActionState> {
  const saleId = parseCancelSaleFormData(formData).saleId.trim();
  const supabaseClient = await createSupabaseServerClient();

  const result = await cancelSaleActionService(previousState, formData, {
    currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
      supabaseClient as unknown as SupabaseCurrentUserProfileClient,
    ),
    getCurrentDate: () => new Date(),
    saleCancellationRepository: new SupabaseSaleCancellationRepository(
      supabaseClient as unknown as SupabaseSaleCancellationClient,
    ),
    saleDetailRepository: new SupabaseSaleDetailRepository(
      supabaseClient as unknown as SupabaseSaleDetailClient,
    ),
  });

  if (result.successMessage) {
    revalidatePath("/sales");

    if (saleId) {
      revalidatePath(`/sales/${saleId}`);
    }
  }

  return result;
}
