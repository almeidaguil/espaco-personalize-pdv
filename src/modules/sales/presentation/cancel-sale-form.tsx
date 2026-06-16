"use client";

import { useActionState, useState } from "react";

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
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-2">
        <h2 className="text-base font-semibold text-slate-950">Cancelamento</h2>
        <p className="text-sm leading-6 text-slate-600">
          Ao cancelar, o estoque dos itens vendidos volta automaticamente e o
          historico da venda permanece registrado. Esta acao exige senha
          administrativa.
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
        <div className="mb-4 grid gap-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="adminPassword"
          >
            Senha administrativa
          </label>
          <input
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
            disabled={isPending || isCanceled}
            id="adminPassword"
            name="adminPassword"
            placeholder="Senha temporaria"
            type="password"
          />
        </div>
        <label className="mb-4 flex items-start gap-3 rounded-md border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-900">
          <input
            checked={isConfirmed}
            className="mt-1 h-4 w-4 accent-red-700"
            disabled={isPending || isCanceled}
            name="confirmCancellation"
            onChange={(event) => setIsConfirmed(event.target.checked)}
            type="checkbox"
          />
          <span>
            Confirmo que esta venda deve ser cancelada e que o estoque sera
            devolvido automaticamente.
          </span>
        </label>
        <button
          className="h-11 w-full rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
          disabled={isSubmitDisabled}
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
