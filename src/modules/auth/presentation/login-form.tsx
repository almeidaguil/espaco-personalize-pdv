"use client";

import { useActionState, useState } from "react";

import { FieldError } from "@/shared/components/field-error";
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

  const errors = state.fieldErrors;

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
      className="grid gap-5"
      noValidate
      onSubmit={handleSubmit}
    >
      {/* E-mail */}
      <div className="grid gap-2">
        <label className="text-sm font-medium text-neutral-200" htmlFor="email">
          E-mail
        </label>

        <div
          className={`flex h-13 items-center rounded-xl border bg-white/[0.035] transition ${
            errors?.email
              ? "border-red-400/70"
              : "border-white/15 focus-within:border-[var(--brand-accent)]"
          } focus-within:ring-2 focus-within:ring-[var(--brand-accent)]/10`}
        >
          <span className="flex h-full w-12 items-center justify-center text-[var(--brand-accent)]">
            <MailIcon />
          </span>

          <input
            aria-describedby={errors?.email ? "email-error" : undefined}
            aria-invalid={errors?.email ? true : undefined}
            autoComplete="email"
            className="h-full min-w-0 flex-1 bg-transparent pr-4 text-base text-white outline-none placeholder:text-neutral-600"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="operador@email.com"
            type="email"
            value={email}
          />
        </div>

        {errors?.email ? (
          <FieldError id="email-error">{errors.email}</FieldError>
        ) : null}
      </div>

      {/* Senha */}
      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-neutral-200"
          htmlFor="password"
        >
          Senha
        </label>

        <div
          className={`flex h-13 items-center rounded-xl border bg-white/[0.035] transition ${
            errors?.password
              ? "border-red-400/70"
              : "border-white/15 focus-within:border-[var(--brand-accent)]"
          } focus-within:ring-2 focus-within:ring-[var(--brand-accent)]/10`}
        >
          <span className="flex h-full w-12 items-center justify-center text-[var(--brand-accent)]">
            <LockIcon />
          </span>

          <input
            aria-describedby={errors?.password ? "password-error" : undefined}
            aria-invalid={errors?.password ? true : undefined}
            autoComplete="current-password"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-neutral-600"
            id="password"
            name="password"
            placeholder="Sua senha"
            type={showPassword ? "text" : "password"}
          />

          <button
            aria-controls="password"
            aria-pressed={showPassword}
            className="mr-2 flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--brand-accent)] transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/30"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            <EyeIcon />

            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        {errors?.password ? (
          <FieldError id="password-error">{errors.password}</FieldError>
        ) : null}
      </div>

      {/* Lembrar */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3.5">
        <input
          checked={rememberEmail}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-accent)]"
          name="rememberEmail"
          onChange={(event) => setRememberEmail(event.target.checked)}
          type="checkbox"
          value="true"
        />

        <span>
          <span className="block text-sm font-medium text-neutral-200">
            Lembrar e-mail
          </span>

          <span className="mt-1 block text-xs leading-5 text-neutral-500">
            Mantenha apenas o e-mail neste dispositivo. A sessão continua segura
            pelo Supabase.
          </span>
        </span>
      </label>

      {/* Erro */}
      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}

      {/* Entrar */}
      <button
        className="group mt-1 flex h-13 items-center justify-center gap-3 rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-5 text-sm font-bold text-[#15110a] shadow-[0_12px_35px_rgba(205,163,79,0.15)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_16px_40px_rgba(205,163,79,0.2)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Entrando..." : "Entrar"}

        {!isPending ? (
          <span
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        ) : null}
      </button>

      {/* Ajuda */}
      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-white/8" />

        <p className="max-w-[320px] text-center text-xs leading-5 text-neutral-500">
          Esqueceu a senha? Solicite a redefinição a um usuário admin em{" "}
          <span className="text-[var(--brand-accent)]">Configurações</span>.
        </p>

        <div className="h-px flex-1 bg-white/8" />
      </div>
    </form>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 6.75A1.75 1.75 0 0 1 5.75 5h12.5A1.75 1.75 0 0 1 20 6.75v10.5A1.75 1.75 0 0 1 18.25 19H5.75A1.75 1.75 0 0 1 4 17.25V6.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="m5 7 7 5 7-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <rect
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        width="14"
        x="5"
        y="10"
      />

      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <circle
        cx="12"
        cy="12"
        r="2.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function getRememberedEmail(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(rememberedEmailKey) ?? "";
}
