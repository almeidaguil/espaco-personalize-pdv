"use client";

import { useActionState } from "react";

import { InlineFeedback } from "@/shared/components/inline-feedback";

import type { UserActionState } from "./user-action-state";

const initialState: UserActionState = {};

type CreateUserFormProps = {
  action: (
    previousState: UserActionState,
    formData: FormData,
  ) => Promise<UserActionState>;
};

export function CreateUserForm({ action }: CreateUserFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="fullName"
        >
          Nome completo
        </label>
        <input
          className="h-11 rounded-md border border-slate-300 px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="fullName"
          name="fullName"
          type="text"
        />
        {state.fieldErrors?.fullName ? (
          <p className="text-sm text-red-700">{state.fieldErrors.fullName}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          E-mail
        </label>
        <input
          className="h-11 rounded-md border border-slate-300 px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="email"
          name="email"
          type="email"
        />
        {state.fieldErrors?.email ? (
          <p className="text-sm text-red-700">{state.fieldErrors.email}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="temporaryPassword"
        >
          Senha temporaria
        </label>
        <input
          className="h-11 rounded-md border border-slate-300 px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="temporaryPassword"
          name="temporaryPassword"
          type="password"
        />
        {state.fieldErrors?.temporaryPassword ? (
          <p className="text-sm text-red-700">
            {state.fieldErrors.temporaryPassword}
          </p>
        ) : null}
      </div>

      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}

      {state.successMessage ? (
        <InlineFeedback tone="success">{state.successMessage}</InlineFeedback>
      ) : null}

      <button
        className="h-11 rounded-md bg-[#1e3275] px-4 text-sm font-semibold text-white transition hover:bg-[#17275c] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Criando..." : "Criar operador"}
      </button>
    </form>
  );
}
