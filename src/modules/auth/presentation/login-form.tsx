"use client";

import { useActionState, useState } from "react";

import { InlineFeedback } from "@/shared/components/inline-feedback";

import type { LoginActionState } from "./login-action-state";

const initialState: LoginActionState = {};
const rememberedEmailKey = "espaco-personalize:remembered-email";

type LoginFormProps = {
  action: (
    previousState: LoginActionState,
    formData: FormData,
  ) => Promise<LoginActionState>;
};

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [email, setEmail] = useState(getRememberedEmail);
  const [rememberEmail, setRememberEmail] = useState(
    () => getRememberedEmail() !== "",
  );
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit() {
    if (rememberEmail) {
      window.localStorage.setItem(rememberedEmailKey, email.trim());
      return;
    }

    window.localStorage.removeItem(rememberedEmailKey);
  }

  return (
    <form
      action={formAction}
      className="grid gap-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          E-mail
        </label>
        <input
          autoComplete="email"
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="operador@email.com"
          type="email"
          value={email}
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
        <div className="flex rounded-md border border-slate-300 bg-white transition focus-within:border-[#1e3275] focus-within:ring-2 focus-within:ring-[#1e3275]/15">
          <input
            autoComplete="current-password"
            className="h-11 min-w-0 flex-1 rounded-l-md bg-transparent px-3 text-base outline-none"
            id="password"
            name="password"
            placeholder="Sua senha"
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-controls="password"
            aria-pressed={showPassword}
            className="h-11 rounded-r-md px-3 text-sm font-semibold text-[#1e3275] transition hover:bg-[#1e3275]/5"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {state.fieldErrors?.password ? (
          <p className="text-sm text-red-700">{state.fieldErrors.password}</p>
        ) : null}
      </div>

      <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
        <input
          checked={rememberEmail}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1e3275] focus:ring-[#1e3275]"
          name="rememberEmail"
          onChange={(event) => setRememberEmail(event.target.checked)}
          type="checkbox"
          value="true"
        />
        <span>
          <span className="font-medium text-slate-800">Lembrar e-mail</span>
          <span className="block text-xs leading-5 text-slate-500">
            Mantem apenas o e-mail neste dispositivo. A sessao continua segura
            pelo Supabase.
          </span>
        </span>
      </label>

      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}

      <button
        className="h-11 rounded-md bg-[#1e3275] px-4 text-sm font-semibold text-white transition hover:bg-[#17275c] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-xs leading-5 text-slate-500">
        Esqueceu a senha? Solicite a redefinicao a um usuario admin em
        Configuracoes.
      </p>
    </form>
  );
}

function getRememberedEmail(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(rememberedEmailKey) ?? "";
}
