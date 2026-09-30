"use client";

import { useActionState } from "react";

import { FieldError } from "@/shared/components/field-error";
import { InlineFeedback } from "@/shared/components/inline-feedback";

import type { StockAdjustmentActionState } from "./stock-adjustment-action-state";

const initialState: StockAdjustmentActionState = {};

export type StockAdjustmentProductOption = {
  id: string;
  label: string;
};

type StockAdjustmentFormProps = {
  action: (
    previousState: StockAdjustmentActionState,
    formData: FormData,
  ) => Promise<StockAdjustmentActionState>;
  products: StockAdjustmentProductOption[];
};

export function StockAdjustmentForm({
  action,
  products,
}: StockAdjustmentFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const hasProducts = products.length > 0;
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-[var(--brand-foreground)]"
          htmlFor="productId"
        >
          Produto
        </label>

        <select
          aria-describedby={errors?.productId ? "productId-error" : undefined}
          aria-invalid={errors?.productId ? true : undefined}
          className="h-12 w-full min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--brand-muted)]"
          disabled={!hasProducts}
          id="productId"
          name="productId"
        >
          <option value="">
            {hasProducts ? "Selecione um produto" : "Nenhum produto ativo"}
          </option>

          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.label}
            </option>
          ))}
        </select>

        {errors?.productId ? (
          <FieldError id="productId-error">{errors.productId}</FieldError>
        ) : null}
      </div>

      <fieldset
        aria-describedby={errors?.type ? "type-error" : undefined}
        aria-invalid={errors?.type ? true : undefined}
        className="grid gap-2"
      >
        <legend className="text-sm font-semibold text-[var(--brand-foreground)]">
          Tipo de ajuste
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm text-[var(--brand-muted)] transition hover:border-[var(--brand-accent)]/60">
            <input
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-accent)]"
              defaultChecked
              name="type"
              type="radio"
              value="initial_adjustment"
            />

            <span>
              <strong className="block font-semibold text-[var(--brand-foreground)]">
                Ajuste inicial
              </strong>

              <span className="mt-1 block leading-5">
                Entrada positiva para preparar o saldo inicial do produto.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm text-[var(--brand-muted)] transition hover:border-[var(--brand-accent)]/60">
            <input
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-accent)]"
              name="type"
              type="radio"
              value="manual_adjustment"
            />

            <span>
              <strong className="block font-semibold text-[var(--brand-foreground)]">
                Ajuste manual
              </strong>

              <span className="mt-1 block leading-5">
                Use valor positivo para entrada e negativo para saída.
              </span>
            </span>
          </label>
        </div>

        {errors?.type ? (
          <FieldError id="type-error">{errors.type}</FieldError>
        ) : null}
      </fieldset>

      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-[var(--brand-foreground)]"
          htmlFor="quantity"
        >
          Quantidade
        </label>

        <input
          aria-describedby={errors?.quantity ? "quantity-error" : undefined}
          aria-invalid={errors?.quantity ? true : undefined}
          className="h-12 w-full min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
          id="quantity"
          inputMode="numeric"
          name="quantity"
          placeholder="Ex.: 10"
          type="number"
        />

        {errors?.quantity ? (
          <FieldError id="quantity-error">{errors.quantity}</FieldError>
        ) : null}
      </div>

      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}

      {state.successMessage ? (
        <InlineFeedback tone="success">{state.successMessage}</InlineFeedback>
      ) : null}

      <button
        className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-5 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending || !hasProducts}
        type="submit"
      >
        {isPending ? "Ajustando..." : "Registrar ajuste"}
      </button>
    </form>
  );
}
