"use server";

import { revalidatePath } from "next/cache";

import { updateProductUseCase } from "../application/update-product-use-case";
import {
  SupabaseProductRepository,
  type SupabaseProductClient,
} from "../infra/supabase-product-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

import {
  createProductFormValuesFromProduct,
  getProductFormValues,
  parseCreateProductFormData,
} from "./product-form-data";
import type { ProductActionState } from "./product-action-state";

export async function updateProductAction(
  productId: string,
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const values = getProductFormValues(formData);
  const supabaseClient = await createSupabaseServerClient();
  const productRepository = new SupabaseProductRepository(
    supabaseClient as unknown as SupabaseProductClient,
  );

  const result = await updateProductUseCase(
    productId,
    parseCreateProductFormData(formData),
    {
      productRepository,
    },
  );

  if (!result.success) {
    return {
      fieldErrors: result.fieldErrors,
      formError: result.formError,
      values,
    };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}/edit`);
  revalidatePath("/pdv");
  revalidatePath("/stock");

  return {
    successMessage: "Produto atualizado com sucesso.",
    values: createProductFormValuesFromProduct({
      isActive: result.product.isActive,
      name: result.product.name,
      priceInReais: result.product.price.toReais(),
      sku: result.product.sku,
    }),
  };
}
