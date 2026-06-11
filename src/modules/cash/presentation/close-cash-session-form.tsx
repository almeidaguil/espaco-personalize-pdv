"use client";

import { useActionState } from "react";

import type { CashSessionActionState } from "./cash-session-action-state";

const initialState: CashSessionActionState = {};

export type CloseCashSessionOption = {
  id: string;
  label: string;
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
    <form action={formAction} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="cashSessionId"
        >
          Caixa aberto
        </label>
        <select
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          defaultValue=""
          id="cashSessionId"
          name="cashSessionId"
        >
          <option disabled value="">
            Selecione um caixa
          </option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.label}
            </option>
          ))}
        </select>
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
  );
}
