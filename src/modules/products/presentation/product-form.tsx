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
    <form action={formAction} className="grid gap-5" key={formKey} noValidate>
      {/* Nome */}
      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-[var(--brand-foreground)]"
          htmlFor="name"
        >
          Nome do produto
        </label>

        <input
          aria-describedby={nameError ? "name-error" : undefined}
          aria-invalid={nameError ? true : undefined}
          autoComplete="off"
          className={
            nameError
              ? "h-12 w-full rounded-xl border border-red-300 bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
              : "h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
          }
          defaultValue={values.name}
          id="name"
          name="name"
          placeholder="Ex.: Camiseta básica preta"
          type="text"
        />

        {nameError ? (
          <FieldError id="name-error">{nameError}</FieldError>
        ) : null}
      </div>

      {/* Preço + SKU */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <label
            className="text-sm font-semibold text-[var(--brand-foreground)]"
            htmlFor="priceInReais"
          >
            Preço
          </label>

          <input
            aria-describedby={priceError ? "priceInReais-error" : undefined}
            aria-invalid={priceError ? true : undefined}
            className={
              priceError
                ? "h-12 w-full rounded-xl border border-red-300 bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                : "h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
            }
            defaultValue={values.priceInReais}
            id="priceInReais"
            inputMode="decimal"
            name="priceInReais"
            placeholder="Ex.: 89,90"
            type="text"
          />

          {priceError ? (
            <FieldError id="priceInReais-error">{priceError}</FieldError>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            className="text-sm font-semibold text-[var(--brand-foreground)]"
            htmlFor="sku"
          >
            SKU
          </label>

          <input
            aria-describedby={skuError ? "sku-error" : undefined}
            aria-invalid={skuError ? true : undefined}
            autoComplete="off"
            className={
              skuError
                ? "h-12 w-full rounded-xl border border-red-300 bg-white px-3 text-base uppercase text-[var(--brand-foreground)] outline-none transition placeholder:normal-case placeholder:text-neutral-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                : "h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base uppercase text-[var(--brand-foreground)] outline-none transition placeholder:normal-case placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
            }
            defaultValue={values.sku}
            id="sku"
            name="sku"
            placeholder="Ex.: CAM-001"
            type="text"
          />

          {skuError ? <FieldError id="sku-error">{skuError}</FieldError> : null}
        </div>
      </div>

      {/* Produto ativo */}
      <input name="isActive" type="hidden" value="false" />

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 transition hover:border-[var(--brand-accent)]/50">
        <input
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-accent)]"
          defaultChecked={values.isActive}
          name="isActive"
          type="checkbox"
          value="true"
        />

        <span>
          <span className="block text-sm font-semibold text-[var(--brand-foreground)]">
            Produto ativo
          </span>

          <span className="mt-1 block text-xs leading-5 text-[var(--brand-muted)]">
            Produtos ativos ficam disponíveis para vendas e movimentações de
            estoque.
          </span>
        </span>
      </label>

      {/* Feedback */}
      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}

      {state.successMessage ? (
        <InlineFeedback tone="success">{state.successMessage}</InlineFeedback>
      ) : null}

      {/* Ação */}
      <div className="flex border-t border-[var(--border)] pt-5 sm:justify-end">
        <button
          className="h-12 w-full rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-6 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-44"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
