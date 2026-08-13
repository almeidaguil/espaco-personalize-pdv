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
    <form action={formAction} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="fullName"
        >
          Nome completo
        </label>
        <input
          aria-describedby={errors?.fullName ? "fullName-error" : undefined}
          aria-invalid={errors?.fullName ? true : undefined}
          className="h-11 rounded-md border border-slate-300 px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="fullName"
          name="fullName"
          type="text"
        />
        {errors?.fullName ? (
          <FieldError id="fullName-error">{errors.fullName}</FieldError>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          E-mail
        </label>
        <input
          aria-describedby={errors?.email ? "email-error" : undefined}
          aria-invalid={errors?.email ? true : undefined}
          className="h-11 rounded-md border border-slate-300 px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="email"
          name="email"
          type="email"
        />
        {errors?.email ? (
          <FieldError id="email-error">{errors.email}</FieldError>
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
          aria-describedby={
            errors?.temporaryPassword ? "temporaryPassword-error" : undefined
          }
          aria-invalid={errors?.temporaryPassword ? true : undefined}
          className="h-11 rounded-md border border-slate-300 px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="temporaryPassword"
          name="temporaryPassword"
          type="password"
        />
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
