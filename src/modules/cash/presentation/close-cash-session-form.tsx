"use client";

import { useActionState } from "react";

import type { CashSessionActionState } from "./cash-session-action-state";

const initialState: CashSessionActionState = {};

export type CloseCashSessionOption = {
  canceledSalesCount: number;
  canceledSalesTotalInReais: number;
  completedSalesCount: number;
  completedSalesTotalInReais: number;
  expectedAmountInReais: number;
  id: string;
  label: string;
  openingAmountInReais: number;
};

type CloseCashSessionFormProps = {
  action: (
    previousState: CashSessionActionState,
    formData: FormData,
  ) => Promise<CashSessionActionState>;
  sessions: CloseCashSessionOption[];
};

export function CloseCashSessionForm({
  action,
  sessions,
}: CloseCashSessionFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div className="grid gap-4">
      {sessions.map((session) => (
        <form
          action={formAction}
          className="grid gap-4 rounded-md border border-slate-200 bg-white p-4"
          key={session.id}
          noValidate
        >
          <input name="cashSessionId" type="hidden" value={session.id} />

          <div>
            <p className="text-sm font-semibold text-slate-950">
              {session.label}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <SummaryItem
                label="Inicial"
                value={moneyFormatter.format(session.openingAmountInReais)}
              />
              <SummaryItem
                label="Vendido"
                value={moneyFormatter.format(
                  session.completedSalesTotalInReais,
                )}
              />
              <SummaryItem
                label="Esperado"
                value={moneyFormatter.format(session.expectedAmountInReais)}
              />
              <SummaryItem
                label="Cancelado"
                value={moneyFormatter.format(session.canceledSalesTotalInReais)}
              />
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              {session.completedSalesCount} vendas concluidas ·{" "}
              {session.canceledSalesCount} canceladas
            </p>
          </div>

          <div className="grid gap-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor={`countedAmountInReais-${session.id}`}
            >
              Valor contado no caixa
            </label>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
              id={`countedAmountInReais-${session.id}`}
              inputMode="decimal"
              name="countedAmountInReais"
              placeholder="0,00"
              type="text"
            />
            {state.fieldErrors?.countedAmountInReais ? (
              <p className="text-sm text-red-700">
                {state.fieldErrors.countedAmountInReais}
              </p>
            ) : null}
            {state.fieldErrors?.cashSessionId ? (
              <p className="text-sm text-red-700">
                {state.fieldErrors.cashSessionId}
              </p>
            ) : null}
          </div>

          {state.formError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.formError}
            </p>
          ) : null}

          {state.successMessage ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {state.successMessage}
            </p>
          ) : null}

          <button
            className="h-11 rounded-md bg-[#1e3275] px-4 text-sm font-semibold text-white transition hover:bg-[#17275c] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Fechando..." : "Fechar caixa"}
          </button>
        </form>
      ))}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});
