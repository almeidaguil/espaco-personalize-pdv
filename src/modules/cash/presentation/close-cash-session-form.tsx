"use client";

import { useActionState, useState } from "react";

import { FieldError } from "@/shared/components/field-error";
import { InlineFeedback } from "@/shared/components/inline-feedback";

import type { CashSessionActionState } from "./cash-session-action-state";
import { parseBrlCurrencyInput } from "./open-cash-session-form-data";

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
  const [countedAmountInputs, setCountedAmountInputs] = useState<
    Record<string, string>
  >({});

  return (
    <div className="grid gap-4">
      {sessions.map((session) => {
        const cashSessionError = state.fieldErrors?.cashSessionId;
        const countedAmountError = state.fieldErrors?.countedAmountInReais;
        const cashSessionErrorId = `cashSessionId-error-${session.id}`;
        const countedAmountErrorId = `countedAmountInReais-error-${session.id}`;
        const countedAmountInReais = parseBrlCurrencyInput(
          countedAmountInputs[session.id] ?? "",
        );
        const hasCountedAmount = Number.isFinite(countedAmountInReais);
        const differenceAmountInReais = hasCountedAmount
          ? countedAmountInReais - session.expectedAmountInReais
          : 0;
        const shortageAmountInReais =
          hasCountedAmount &&
          countedAmountInReais < session.expectedAmountInReais
            ? session.expectedAmountInReais - countedAmountInReais
            : 0;
        const hasShortage = shortageAmountInReais > 0;

        return (
          <form
            action={formAction}
            aria-describedby={cashSessionError ? cashSessionErrorId : undefined}
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
                  value={moneyFormatter.format(
                    session.canceledSalesTotalInReais,
                  )}
                />
              </dl>
              <p className="mt-2 text-xs text-slate-500">
                {session.completedSalesCount} vendas concluidas -{" "}
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
                aria-describedby={
                  countedAmountError ? countedAmountErrorId : undefined
                }
                aria-invalid={countedAmountError ? true : undefined}
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
                id={`countedAmountInReais-${session.id}`}
                inputMode="decimal"
                name="countedAmountInReais"
                onChange={(event) =>
                  setCountedAmountInputs((currentInputs) => ({
                    ...currentInputs,
                    [session.id]: event.target.value,
                  }))
                }
                placeholder="0,00"
                type="text"
                value={countedAmountInputs[session.id] ?? ""}
              />
              {countedAmountError ? (
                <FieldError id={countedAmountErrorId}>
                  {countedAmountError}
                </FieldError>
              ) : null}
              {cashSessionError ? (
                <FieldError id={cashSessionErrorId}>
                  {cashSessionError}
                </FieldError>
              ) : null}
              {hasCountedAmount ? (
                <p
                  className={
                    differenceAmountInReais < 0
                      ? "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
                      : differenceAmountInReais > 0
                        ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
                        : "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                  }
                >
                  {formatCashDifference(differenceAmountInReais)}
                </p>
              ) : null}
            </div>

            {hasShortage ? (
              <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">
                  Faltam {moneyFormatter.format(shortageAmountInReais)} no
                  caixa.
                </p>
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium text-amber-950"
                    htmlFor={`adminPassword-${session.id}`}
                  >
                    Senha administrativa
                  </label>
                  <input
                    className="h-11 rounded-md border border-amber-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
                    id={`adminPassword-${session.id}`}
                    name="adminPassword"
                    placeholder="Senha temporaria"
                    type="password"
                  />
                  <p className="text-xs leading-5 text-amber-900">
                    Necessaria apenas quando o valor contado e menor que o
                    esperado.
                  </p>
                </div>
              </div>
            ) : null}

            {state.formError ? (
              <InlineFeedback tone="error">{state.formError}</InlineFeedback>
            ) : null}

            {state.successMessage ? (
              <InlineFeedback tone="success">
                {state.successMessage}
              </InlineFeedback>
            ) : null}

            <button
              className="h-11 rounded-md bg-[#1e3275] px-4 text-sm font-semibold text-white transition hover:bg-[#17275c] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Fechando..." : "Fechar caixa"}
            </button>
          </form>
        );
      })}
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

function formatCashDifference(differenceAmountInReais: number): string {
  if (differenceAmountInReais < 0) {
    return `Diferenca: faltam ${moneyFormatter.format(
      Math.abs(differenceAmountInReais),
    )}`;
  }

  if (differenceAmountInReais > 0) {
    return `Diferenca: sobram ${moneyFormatter.format(
      differenceAmountInReais,
    )}`;
  }

  return "Diferenca: sem divergencia";
}

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});
