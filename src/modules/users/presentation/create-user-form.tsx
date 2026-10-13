"use client";

import { useActionState } from "react";

import { FieldError } from "@/shared/components/field-error";
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

  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-[var(--brand-foreground)]"
          htmlFor="fullName"
        >
          Nome completo
        </label>

        <input
          aria-describedby={errors?.fullName ? "fullName-error" : undefined}
          aria-invalid={errors?.fullName ? true : undefined}
          autoComplete="name"
          className={
            errors?.fullName
              ? "h-12 w-full rounded-xl border border-red-300 bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
              : "h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
          }
          id="fullName"
          name="fullName"
          placeholder="Nome do operador"
          type="text"
        />

        {errors?.fullName ? (
          <FieldError id="fullName-error">{errors.fullName}</FieldError>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-[var(--brand-foreground)]"
          htmlFor="email"
        >
          E-mail
        </label>

        <input
          aria-describedby={errors?.email ? "email-error" : undefined}
          aria-invalid={errors?.email ? true : undefined}
          autoComplete="email"
          className={
            errors?.email
              ? "h-12 w-full rounded-xl border border-red-300 bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
              : "h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
          }
          id="email"
          name="email"
          placeholder="operador@exemplo.com"
          type="email"
        />

        {errors?.email ? (
          <FieldError id="email-error">{errors.email}</FieldError>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-[var(--brand-foreground)]"
          htmlFor="temporaryPassword"
        >
          Senha temporária
        </label>

        <input
          aria-describedby={
            errors?.temporaryPassword ? "temporaryPassword-error" : undefined
          }
          aria-invalid={errors?.temporaryPassword ? true : undefined}
          autoComplete="new-password"
          className={
            errors?.temporaryPassword
              ? "h-12 w-full rounded-xl border border-red-300 bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
              : "h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
          }
          id="temporaryPassword"
          name="temporaryPassword"
          placeholder="Defina uma senha inicial"
          type="password"
        />

        <p className="text-xs leading-5 text-[var(--brand-muted)]">
          O operador utilizará esta senha para realizar o primeiro acesso.
        </p>

        {errors?.temporaryPassword ? (
          <FieldError id="temporaryPassword-error">
            {errors.temporaryPassword}
          </FieldError>
        ) : null}
      </div>

      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}

      {state.successMessage ? (
        <InlineFeedback tone="success">{state.successMessage}</InlineFeedback>
      ) : null}

      <div className="flex border-t border-[var(--border)] pt-5">
        <button
          className="h-12 w-full rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-5 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Criando..." : "Criar operador"}
        </button>
      </div>
    </form>
  );
}
