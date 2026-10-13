"use client";

import { useActionState, useState } from "react";

import { InlineFeedback } from "@/shared/components/inline-feedback";
import { Panel } from "@/shared/components/panel";

import type { CancelSaleActionState } from "./cancel-sale-action-state";

const initialState: CancelSaleActionState = {};

type CancelSaleFormProps = {
  action: (
    previousState: CancelSaleActionState,
    formData: FormData,
  ) => Promise<CancelSaleActionState>;
  isCanceled: boolean;
  saleId: string;
};

export function CancelSaleForm({
  action,
  isCanceled,
  saleId,
}: CancelSaleFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [isConfirmed, setIsConfirmed] = useState(false);

  const isSubmitDisabled = isPending || isCanceled || !isConfirmed;

  return (
    <Panel>
      <div className="grid gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-600">
          Ação administrativa
        </p>

        <h2 className="text-lg font-bold text-[var(--brand-foreground)]">
          Cancelamento da venda
        </h2>

        <p className="max-w-2xl text-sm leading-6 text-[var(--brand-muted)]">
          Ao cancelar, o estoque dos itens vendidos será devolvido
          automaticamente e o histórico da venda continuará registrado.
        </p>
      </div>

      {state.formError ? (
        <InlineFeedback className="mt-4" tone="error">
          {state.formError}
        </InlineFeedback>
      ) : null}

      {state.successMessage ? (
        <InlineFeedback className="mt-4" tone="success">
          {state.successMessage}
        </InlineFeedback>
      ) : null}

      <form action={formAction} className="mt-5 grid gap-4" noValidate>
        <input name="saleId" type="hidden" value={saleId} />

        <div className="grid gap-2">
          <label
            className="text-sm font-semibold text-[var(--brand-foreground)]"
            htmlFor="adminPassword"
          >
            Senha administrativa
          </label>

          <input
            className="h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
            disabled={isPending || isCanceled}
            id="adminPassword"
            name="adminPassword"
            placeholder="Digite a senha temporária"
            type="password"
          />

          <p className="text-xs leading-5 text-[var(--brand-muted)]">
            Esta ação exige autorização administrativa.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm leading-6 text-red-900">
          <input
            checked={isConfirmed}
            className="mt-1 h-4 w-4 shrink-0 accent-red-700"
            disabled={isPending || isCanceled}
            name="confirmCancellation"
            onChange={(event) => setIsConfirmed(event.target.checked)}
            type="checkbox"
          />

          <span>
            Confirmo que esta venda deve ser cancelada e que o estoque será
            devolvido automaticamente.
          </span>
        </label>

        <div className="flex border-t border-[var(--border)] pt-5 sm:justify-end">
          <button
            className="h-12 w-full rounded-xl border border-red-200 bg-red-50 px-6 text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-44"
            disabled={isSubmitDisabled}
            type="submit"
          >
            {isCanceled
              ? "Venda cancelada"
              : isPending
                ? "Cancelando..."
                : "Cancelar venda"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
