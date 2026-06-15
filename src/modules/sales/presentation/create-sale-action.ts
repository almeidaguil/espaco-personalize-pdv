"use server";

import { randomUUID } from "node:crypto";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import {
  SupabaseCashSessionRepository,
  type SupabaseCashSessionClient,
} from "@/modules/cash/infra/supabase-cash-session-repository";
import {
  SupabaseProductRepository,
  type SupabaseProductClient,
} from "@/modules/products/infra/supabase-product-repository";
import {
  SupabaseStockMovementRepository,
  type SupabaseStockMovementClient,
} from "@/modules/stock/infra/supabase-stock-movement-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

import {
  SupabaseSaleRepository,
  type SupabaseSaleClient,
} from "../infra/supabase-sale-repository";
import { createSaleActionService } from "./create-sale-action-service";
import type { SaleActionState } from "./sale-action-state";

export async function createSaleAction(
  previousState: SaleActionState,
  formData: FormData,
): Promise<SaleActionState> {
  const supabaseClient = await createSupabaseServerClient();

  return createSaleActionService(previousState, formData, {
    cashSessionRepository: new SupabaseCashSessionRepository(
      supabaseClient as unknown as SupabaseCashSessionClient,
    ),
    currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
      supabaseClient as unknown as SupabaseCurrentUserProfileClient,
    ),
    generateSaleId: randomUUID,
    generateStockMovementId: randomUUID,
    getCurrentDate: () => new Date(),
    productRepository: new SupabaseProductRepository(
      supabaseClient as unknown as SupabaseProductClient,
    ),
    saleRepository: new SupabaseSaleRepository(
      supabaseClient as unknown as SupabaseSaleClient,
    ),
    stockMovementRepository: new SupabaseStockMovementRepository(
      supabaseClient as unknown as SupabaseStockMovementClient,
    ),
  });
}
