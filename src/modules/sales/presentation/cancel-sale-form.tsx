"use client";

import { useActionState } from "react";

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

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-2">
        <h2 className="text-base font-semibold text-slate-950">Cancelamento</h2>
        <p className="text-sm leading-6 text-slate-600">
          Ao cancelar, o estoque dos itens vendidos volta automaticamente e o
          historico da venda permanece registrado.
        </p>
      </div>

      {state.formError ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.formError}
        </p>
      ) : null}

      {state.successMessage ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.successMessage}
        </p>
      ) : null}

      <form action={formAction} className="mt-4" noValidate>
        <input name="saleId" type="hidden" value={saleId} />
        <button
          className="h-11 w-full rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
          disabled={isPending || isCanceled}
          type="submit"
        >
          {isCanceled
            ? "Venda cancelada"
            : isPending
              ? "Cancelando..."
              : "Cancelar venda"}
        </button>
      </form>
    </section>
  );
}
