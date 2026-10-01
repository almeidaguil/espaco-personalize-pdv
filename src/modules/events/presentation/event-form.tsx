"use client";

import { useActionState } from "react";

import { FieldError } from "@/shared/components/field-error";
import { InlineFeedback } from "@/shared/components/inline-feedback";

import type { EventActionState } from "./event-action-state";

const initialState: EventActionState = {};

type EventFormProps = {
  action: (
    previousState: EventActionState,
    formData: FormData,
  ) => Promise<EventActionState>;
};

export function EventForm({ action }: EventFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {/* Nome */}
      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-[var(--brand-foreground)]"
          htmlFor="name"
        >
          Nome do evento
        </label>

        <input
          aria-describedby={errors?.name ? "name-error" : undefined}
          aria-invalid={errors?.name ? true : undefined}
          autoComplete="off"
          className={
            errors?.name
              ? "h-12 rounded-xl border border-red-300 bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
              : "h-12 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
          }
          id="name"
          name="name"
          placeholder="Ex.: Operação Setembro"
          type="text"
        />

        {errors?.name ? (
          <FieldError id="name-error">{errors.name}</FieldError>
        ) : null}
      </div>

      {/* Local */}
      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-[var(--brand-foreground)]"
          htmlFor="location"
        >
          Local
        </label>

        <input
          aria-describedby={errors?.location ? "location-error" : undefined}
          aria-invalid={errors?.location ? true : undefined}
          autoComplete="off"
          className={
            errors?.location
              ? "h-12 rounded-xl border border-red-300 bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
              : "h-12 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
          }
          id="location"
          name="location"
          placeholder="Ex.: Loja Roberto Multimarcas"
          type="text"
        />

        {errors?.location ? (
          <FieldError id="location-error">{errors.location}</FieldError>
        ) : null}
      </div>

      {/* Período */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <label
            className="text-sm font-semibold text-[var(--brand-foreground)]"
            htmlFor="startsAt"
          >
            Início
          </label>

          <input
            aria-describedby={errors?.startsAt ? "startsAt-error" : undefined}
            aria-invalid={errors?.startsAt ? true : undefined}
            className={
              errors?.startsAt
                ? "h-12 min-w-0 rounded-xl border border-red-300 bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                : "h-12 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
            }
            id="startsAt"
            name="startsAt"
            type="datetime-local"
          />

          {errors?.startsAt ? (
            <FieldError id="startsAt-error">{errors.startsAt}</FieldError>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            className="text-sm font-semibold text-[var(--brand-foreground)]"
            htmlFor="endsAt"
          >
            Término
          </label>

          <input
            aria-describedby={errors?.endsAt ? "endsAt-error" : undefined}
            aria-invalid={errors?.endsAt ? true : undefined}
            className={
              errors?.endsAt
                ? "h-12 min-w-0 rounded-xl border border-red-300 bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                : "h-12 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
            }
            id="endsAt"
            name="endsAt"
            type="datetime-local"
          />

          {errors?.endsAt ? (
            <FieldError id="endsAt-error">{errors.endsAt}</FieldError>
          ) : null}
        </div>
      </div>

      {/* Evento ativo */}
      <input name="isActive" type="hidden" value="false" />

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 transition hover:border-[var(--brand-accent)]/50">
        <input
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-accent)]"
          defaultChecked
          name="isActive"
          type="checkbox"
          value="true"
        />

        <span>
          <span className="block text-sm font-semibold text-[var(--brand-foreground)]">
            Evento ativo
          </span>

          <span className="mt-1 block text-xs leading-5 text-[var(--brand-muted)]">
            Eventos ativos ficam disponíveis para abertura de caixa e vendas no
            PDV.
          </span>
        </span>
      </label>

      {/* Feedback */}
      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}

      {state.successMessage ? (
        <InlineFeedback tone="success">{state.successMessage}</InlineFeedback>
      ) : null}

      {/* Ação */}
      <div className="flex border-t border-[var(--border)] pt-5 sm:justify-end">
        <button
          className="h-12 w-full rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-6 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-44"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Salvando..." : "Salvar evento"}
        </button>
      </div>
    </form>
  );
}
