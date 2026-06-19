"use server";

import { randomUUID } from "node:crypto";

import { createProductUseCase } from "../application/create-product-use-case";
import {
  SupabaseProductRepository,
  type SupabaseProductClient,
} from "../infra/supabase-product-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

import {
  createEmptyProductFormValues,
  getProductFormValues,
  parseCreateProductFormData,
} from "./product-form-data";
import type { ProductActionState } from "./product-action-state";

export async function createProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const values = getProductFormValues(formData);
  const supabaseClient = await createSupabaseServerClient();
  const productRepository = new SupabaseProductRepository(
    supabaseClient as unknown as SupabaseProductClient,
  );

  const result = await createProductUseCase(
    parseCreateProductFormData(formData),
    {
      generateProductId: randomUUID,
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

  return {
    successMessage: "Produto cadastrado com sucesso.",
    values: createEmptyProductFormValues(),
  };
}
