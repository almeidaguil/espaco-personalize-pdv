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
    <div className="grid gap-5">
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
            className="grid gap-5 rounded-2xl border border-[var(--border)] bg-[var(--brand-surface)] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-6"
            key={session.id}
            noValidate
          >
            <input name="cashSessionId" type="hidden" value={session.id} />

            {/* Cabeçalho */}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-accent-foreground)]">
                Caixa em operação
              </p>

              <h2 className="mt-1.5 text-lg font-bold text-[var(--brand-foreground)]">
                {session.label}
              </h2>

              <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
                Confira o movimento financeiro antes de concluir o fechamento.
              </p>
            </div>

            {/* Resumo financeiro */}
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem
                label="Valor inicial"
                value={moneyFormatter.format(session.openingAmountInReais)}
              />

              <SummaryItem
                label="Vendas"
                value={moneyFormatter.format(
                  session.completedSalesTotalInReais,
                )}
                tone="success"
              />

              <SummaryItem
                highlight
                label="Esperado"
                value={moneyFormatter.format(session.expectedAmountInReais)}
              />

              <SummaryItem
                label="Cancelado"
                value={moneyFormatter.format(session.canceledSalesTotalInReais)}
                tone="danger"
              />
            </dl>

            {/* Quantidade de vendas */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
              <span className="text-[var(--brand-muted)]">
                Concluídas:{" "}
                <strong className="font-bold text-[var(--brand-foreground)]">
                  {session.completedSalesCount}
                </strong>
              </span>

              <span className="text-[var(--brand-muted)]">
                Canceladas:{" "}
                <strong className="font-bold text-[var(--brand-foreground)]">
                  {session.canceledSalesCount}
                </strong>
              </span>
            </div>

            {/* Valor contado */}
            <div className="grid gap-2">
              <label
                className="text-sm font-semibold text-[var(--brand-foreground)]"
                htmlFor={`countedAmountInReais-${session.id}`}
              >
                Valor contado no caixa
              </label>

              <input
                aria-describedby={
                  countedAmountError ? countedAmountErrorId : undefined
                }
                aria-invalid={countedAmountError ? true : undefined}
                className={
                  countedAmountError
                    ? "h-12 w-full rounded-xl border border-red-300 bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    : "h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
                }
                id={`countedAmountInReais-${session.id}`}
                inputMode="decimal"
                name="countedAmountInReais"
                onChange={(event) =>
                  setCountedAmountInputs((currentInputs) => ({
                    ...currentInputs,
                    [session.id]: event.target.value,
                  }))
                }
                placeholder="Ex.: 450,00"
                type="text"
                value={countedAmountInputs[session.id] ?? ""}
              />

              <p className="text-xs leading-5 text-[var(--brand-muted)]">
                Informe o total físico encontrado no caixa após conferir o
                dinheiro.
              </p>

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
            </div>

            {/* Diferença */}
            {hasCountedAmount ? (
              <CashDifference
                differenceAmountInReais={differenceAmountInReais}
              />
            ) : null}

            {/* Autorização administrativa */}
            {hasShortage ? (
              <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div>
                  <p className="text-sm font-bold text-amber-950">
                    Divergência no caixa
                  </p>

                  <p className="mt-1 text-sm leading-6 text-amber-900">
                    Faltam{" "}
                    <strong>
                      {moneyFormatter.format(shortageAmountInReais)}
                    </strong>{" "}
                    em relação ao valor esperado.
                  </p>
                </div>

                <div className="grid gap-2">
                  <label
                    className="text-sm font-semibold text-amber-950"
                    htmlFor={`adminPassword-${session.id}`}
                  >
                    Senha administrativa
                  </label>

                  <input
                    className="h-12 w-full rounded-xl border border-amber-300 bg-white px-3 text-base outline-none transition placeholder:text-amber-700/50 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    id={`adminPassword-${session.id}`}
                    name="adminPassword"
                    placeholder="Digite a senha temporária"
                    type="password"
                  />

                  <p className="text-xs leading-5 text-amber-900">
                    A autorização administrativa é necessária quando o valor
                    contado é menor que o esperado.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Feedback */}
            {state.formError ? (
              <InlineFeedback tone="error">{state.formError}</InlineFeedback>
            ) : null}

            {state.successMessage ? (
              <InlineFeedback tone="success">
                {state.successMessage}
              </InlineFeedback>
            ) : null}

            {/* Ação */}
            <div className="flex border-t border-[var(--border)] pt-5 sm:justify-end">
              <button
                className="h-12 w-full rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-primary)] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-44"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Fechando..." : "Fechar caixa"}
              </button>
            </div>
          </form>
        );
      })}
    </div>
  );
}

type SummaryItemProps = {
  highlight?: boolean;
  label: string;
  tone?: "default" | "success" | "danger";
  value: string;
};

function SummaryItem({
  highlight = false,
  label,
  tone = "default",
  value,
}: SummaryItemProps) {
  const valueClassName =
    tone === "success"
      ? "text-emerald-700"
      : tone === "danger"
        ? "text-red-700"
        : "text-[var(--brand-foreground)]";

  return (
    <div
      className={
        highlight
          ? "rounded-xl border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/[0.07] p-4"
          : "rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
      }
    >
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">
        {label}
      </dt>

      <dd className={`mt-2 text-lg font-bold ${valueClassName}`}>{value}</dd>
    </div>
  );
}

function CashDifference({
  differenceAmountInReais,
}: {
  differenceAmountInReais: number;
}) {
  if (differenceAmountInReais < 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-amber-700">
          Diferença
        </p>

        <p className="mt-1 text-sm font-bold text-amber-950">
          Faltam {moneyFormatter.format(Math.abs(differenceAmountInReais))}
        </p>
      </div>
    );
  }

  if (differenceAmountInReais > 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">
          Diferença
        </p>

        <p className="mt-1 text-sm font-bold text-emerald-800">
          Sobram {moneyFormatter.format(differenceAmountInReais)}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">
        Diferença
      </p>

      <p className="mt-1 text-sm font-bold text-[var(--brand-foreground)]">
        Sem divergência
      </p>
    </div>
  );
}

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});
