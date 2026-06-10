"use client";

import { useActionState } from "react";

import type { LoginActionState } from "./login-action-state";

const initialState: LoginActionState = {};

type LoginFormProps = {
  action: (
    previousState: LoginActionState,
    formData: FormData,
  ) => Promise<LoginActionState>;
};

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          E-mail
        </label>
        <input
          autoComplete="email"
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="email"
          name="email"
          placeholder="operador@email.com"
          type="email"
        />
        {state.fieldErrors?.email ? (
          <p className="text-sm text-red-700">{state.fieldErrors.email}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="password"
        >
          Senha
        </label>
        <input
          autoComplete="current-password"
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="password"
          name="password"
          placeholder="Sua senha"
          type="password"
        />
        {state.fieldErrors?.password ? (
          <p className="text-sm text-red-700">{state.fieldErrors.password}</p>
        ) : null}
      </div>

      {state.formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.formError}
        </p>
      ) : null}

      <button
        className="h-11 rounded-md bg-[#1e3275] px-4 text-sm font-semibold text-white transition hover:bg-[#17275c] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
