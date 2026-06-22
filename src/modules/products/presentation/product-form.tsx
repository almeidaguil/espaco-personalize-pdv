"use client";

import { useActionState } from "react";

import { FieldError } from "@/shared/components/field-error";
import { InlineFeedback } from "@/shared/components/inline-feedback";

import type {
  ProductActionState,
  ProductFormValues,
} from "./product-action-state";
import { createEmptyProductFormValues } from "./product-form-data";

const initialState: ProductActionState = {};

type ProductFormProps = {
  action: (
    previousState: ProductActionState,
    formData: FormData,
  ) => Promise<ProductActionState>;
  initialValues?: ProductFormValues;
  submitLabel?: string;
};

export function ProductForm({
  action,
  initialValues = createEmptyProductFormValues(),
  submitLabel = "Salvar produto",
}: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values ?? initialValues;
  const formKey = JSON.stringify(values);
  const nameError = state.fieldErrors?.name;
  const priceError = state.fieldErrors?.priceInReais;
  const skuError = state.fieldErrors?.sku;

  return (
    <form action={formAction} className="grid gap-4" key={formKey} noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="name">
          Nome do produto
        </label>
        <input
          aria-describedby={nameError ? "name-error" : undefined}
          aria-invalid={nameError ? true : undefined}
          autoComplete="off"
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          defaultValue={values.name}
          id="name"
          name="name"
          placeholder="Caneca personalizada"
          type="text"
        />
        {nameError ? (
          <FieldError id="name-error">{nameError}</FieldError>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="priceInReais"
        >
          Preço
        </label>
        <input
          aria-describedby={priceError ? "priceInReais-error" : undefined}
          aria-invalid={priceError ? true : undefined}
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          defaultValue={values.priceInReais}
          id="priceInReais"
          inputMode="decimal"
          name="priceInReais"
          placeholder="35,00"
          type="text"
        />
        {priceError ? (
          <FieldError id="priceInReais-error">{priceError}</FieldError>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="sku">
          SKU
        </label>
        <input
          aria-describedby={skuError ? "sku-error" : undefined}
          aria-invalid={skuError ? true : undefined}
          autoComplete="off"
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          defaultValue={values.sku}
          id="sku"
          name="sku"
          placeholder="CANECA-001"
          type="text"
        />
        {skuError ? <FieldError id="sku-error">{skuError}</FieldError> : null}
      </div>

      <input name="isActive" type="hidden" value="false" />
      <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
        <input
          className="h-4 w-4 rounded border-slate-300 text-[#1e3275] focus:ring-[#1e3275]"
          defaultChecked={values.isActive}
          name="isActive"
          type="checkbox"
          value="true"
        />
        Produto ativo
      </label>

      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}

      {state.successMessage ? (
        <InlineFeedback tone="success">{state.successMessage}</InlineFeedback>
      ) : null}

      <button
        className="h-11 rounded-md bg-[#1e3275] px-4 text-sm font-semibold text-white transition hover:bg-[#17275c] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}
