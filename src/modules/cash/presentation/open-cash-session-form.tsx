"use client";

import { useActionState } from "react";

import { FieldError } from "@/shared/components/field-error";
import { InlineFeedback } from "@/shared/components/inline-feedback";

import type { CashSessionActionState } from "./cash-session-action-state";

const initialState: CashSessionActionState = {};

type OpenCashSessionFormProps = {
  action: (
    previousState: CashSessionActionState,
    formData: FormData,
  ) => Promise<CashSessionActionState>;
};

export function OpenCashSessionForm({ action }: OpenCashSessionFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {/* Valor inicial */}
      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-[var(--brand-foreground)]"
          htmlFor="openingAmountInReais"
        >
          Valor inicial
        </label>

        <input
          aria-describedby={
            errors?.openingAmountInReais
              ? "openingAmountInReais-error"
              : undefined
          }
          aria-invalid={errors?.openingAmountInReais ? true : undefined}
          className={
            errors?.openingAmountInReais
              ? "h-12 w-full rounded-xl border border-red-300 bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
              : "h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
          }
          id="openingAmountInReais"
          inputMode="decimal"
          name="openingAmountInReais"
          placeholder="Ex.: 150,00"
          type="text"
        />

        <p className="text-xs leading-5 text-[var(--brand-muted)]">
          Informe o valor disponível no caixa antes das primeiras vendas.
        </p>

        {errors?.openingAmountInReais ? (
          <FieldError id="openingAmountInReais-error">
            {errors.openingAmountInReais}
          </FieldError>
        ) : null}
      </div>

      {/* Aviso */}
      <div className="rounded-xl border border-[var(--brand-accent)]/25 bg-[var(--brand-accent)]/[0.06] px-4 py-3">
        <p className="text-sm leading-6 text-[var(--brand-muted)]">
          Após a abertura, este caixa ficará disponível no PDV para registrar
          vendas.
        </p>
      </div>

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
          {isPending ? "Abrindo..." : "Abrir caixa"}
        </button>
      </div>
    </form>
  );
}
