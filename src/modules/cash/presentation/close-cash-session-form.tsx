"use client";

import { useActionState, useState } from "react";

import { FieldError } from "@/shared/components/field-error";
import { InlineFeedback } from "@/shared/components/inline-feedback";
import {
  paymentMethods,
  type PaymentMethod,
} from "@/shared/types/payment-method";

import type { CashSessionActionState } from "./cash-session-action-state";
import { parseBrlCurrencyInput } from "./open-cash-session-form-data";

const initialState: CashSessionActionState = {};
const methodLabels: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
};

export type CloseCashSessionOption = {
  canceledSalesCount: number;
  canceledSalesTotalInCents: number;
  completedSalesCount: number;
  completedSalesTotalInCents: number;
  expectedByMethodInCents: Record<PaymentMethod, number>;
  id: string;
  label: string;
  openingAmountInCents: number;
};

type Props = {
  action: (
    state: CashSessionActionState,
    data: FormData,
  ) => Promise<CashSessionActionState>;
  sessions: CloseCashSessionOption[];
};

export function CloseCashSessionForm({ action, sessions }: Props) {
  return (
    <div className="grid gap-5">
      {sessions.map((session) => (
        <ClosingCard action={action} key={session.id} session={session} />
      ))}
    </div>
  );
}

function ClosingCard({
  action,
  session,
}: {
  action: Props["action"];
  session: CloseCashSessionOption;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [values, setValues] = useState<Record<PaymentMethod, string>>({
    cash: "",
    credit_card: "",
    debit_card: "",
    pix: "",
  });
  const counted = Object.fromEntries(
    paymentMethods.map((method) => [
      method,
      parseBrlCurrencyInput(values[method]) * 100,
    ]),
  ) as Record<PaymentMethod, number>;
  const allValid = paymentMethods.every(
    (method) => Number.isSafeInteger(counted[method]) && counted[method] >= 0,
  );
  const differences = Object.fromEntries(
    paymentMethods.map((method) => [
      method,
      counted[method] - session.expectedByMethodInCents[method],
    ]),
  ) as Record<PaymentMethod, number>;
  const hasDifference =
    allValid && paymentMethods.some((method) => differences[method] !== 0);
  const error = state.fieldErrors?.reconciliations;

  return (
    <form
      action={formAction}
      className="grid gap-5 rounded-2xl border border-[var(--border)] bg-[var(--brand-surface)] p-4 sm:p-6"
      noValidate
    >
      <input name="cashSessionId" type="hidden" value={session.id} />
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-accent-foreground)]">
          Caixa em operação
        </p>
        <h2 className="mt-1 text-lg font-bold">{session.label}</h2>
      </header>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Summary label="Valor inicial" value={session.openingAmountInCents} />
        <Summary
          label="Vendas concluídas"
          value={session.completedSalesTotalInCents}
        />
        <Summary
          label="Vendas canceladas"
          value={session.canceledSalesTotalInCents}
        />
      </dl>
      <p className="text-sm text-[var(--brand-muted)]">
        Concluídas: <strong>{session.completedSalesCount}</strong> · Canceladas:{" "}
        <strong>{session.canceledSalesCount}</strong>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {paymentMethods.map((method) => (
          <section
            className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
            key={method}
          >
            <h3 className="font-bold">{methodLabels[method]}</h3>
            <p className="text-sm">
              Esperado:{" "}
              <strong>{money(session.expectedByMethodInCents[method])}</strong>
            </p>
            <label
              className="text-sm font-semibold"
              htmlFor={`counted-${method}-${session.id}`}
            >
              Valor conferido — {methodLabels[method]}
            </label>
            <input
              className="h-12 rounded-xl border border-[var(--border)] bg-white px-3"
              id={`counted-${method}-${session.id}`}
              inputMode="decimal"
              name={`countedAmount_${method}`}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [method]: event.target.value,
                }))
              }
              placeholder="0,00"
              type="text"
              value={values[method]}
            />
            {allValid ? <Difference value={differences[method]} /> : null}
          </section>
        ))}
      </div>
      {error ? (
        <FieldError id={`reconciliations-error-${session.id}`}>
          {error}
        </FieldError>
      ) : null}
      {state.fieldErrors?.cashSessionId ? (
        <FieldError id={`cash-session-error-${session.id}`}>
          {state.fieldErrors.cashSessionId}
        </FieldError>
      ) : null}
      {hasDifference ? (
        <div className="grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <label
            className="font-semibold"
            htmlFor={`adminPassword-${session.id}`}
          >
            Senha administrativa
          </label>
          <input
            className="h-12 rounded-xl border border-amber-300 bg-white px-3"
            id={`adminPassword-${session.id}`}
            name="adminPassword"
            type="password"
          />
          <p className="text-sm">
            A autorização administrativa é necessária para qualquer sobra ou
            falta.
          </p>
        </div>
      ) : null}
      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}
      {state.successMessage ? (
        <InlineFeedback tone="success">{state.successMessage}</InlineFeedback>
      ) : null}
      <button
        className="h-12 rounded-xl bg-[var(--brand-primary)] px-6 font-bold text-white disabled:opacity-60"
        disabled={!allValid || isPending || Boolean(state.successMessage)}
        type="submit"
      >
        {isPending ? "Fechando..." : "Fechar caixa"}
      </button>
    </form>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <dt className="text-xs font-bold uppercase">{label}</dt>
      <dd className="mt-2 font-bold">{money(value)}</dd>
    </div>
  );
}

function Difference({ value }: { value: number }) {
  if (value === 0) return <p className="text-sm font-bold">Sem divergência</p>;
  return (
    <p className="text-sm font-bold">
      {value > 0 ? "Sobra" : "Falta"}: {money(Math.abs(value))}
    </p>
  );
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(cents / 100);
}
