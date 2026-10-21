"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import {
  SupabaseStockMovementRepository,
  type SupabaseStockMovementClient,
} from "@/modules/stock/infra/supabase-stock-movement-repository";
import {
  SupabaseProductRepository,
  type SupabaseProductClient,
} from "../infra/supabase-product-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";
import { createProductActionService } from "./create-product-action-service";
import type { ProductActionState } from "./product-action-state";

export async function createProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const client = await createSupabaseServerClient();
  const result = await createProductActionService(formData, {
    currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
      client as unknown as SupabaseCurrentUserProfileClient,
    ),
    productRepository: new SupabaseProductRepository(
      client as unknown as SupabaseProductClient,
    ),
    stockMovementRepository: new SupabaseStockMovementRepository(
      client as unknown as SupabaseStockMovementClient,
    ),
    generateProductId: randomUUID,
    generateStockMovementId: randomUUID,
    getCurrentDate: () => new Date(),
  });
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/pdv");
  return result;
}
