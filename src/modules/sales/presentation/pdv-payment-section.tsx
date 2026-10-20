"use client";

import type { ChangeEvent } from "react";

import {
  installmentCounts,
  paymentMethods,
  type PaymentMethod,
} from "@/shared/types/payment-method";
import {
  formatBrlCentsForInput,
  parseBrlCurrencyToCents,
} from "@/shared/utils/brl-currency";

import {
  normalizePaymentDraftsForTotal,
  type PaymentDraft,
  summarizePaymentDrafts,
} from "./pdv-payment";

export type PdvPaymentSectionProps = {
  drafts: PaymentDraft[];
  errorMessage?: string;
  onChange(nextDrafts: PaymentDraft[]): void;
  totalInCents: number;
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export function PdvPaymentSection({
  drafts,
  errorMessage,
  onChange,
  totalInCents,
}: PdvPaymentSectionProps) {
  const normalizedDrafts = normalizePaymentDraftsForTotal(drafts, totalInCents);
  const summary = summarizePaymentDrafts(normalizedDrafts, totalInCents);
  const isSplit = normalizedDrafts.length === 2;

  return (
    <section
      aria-labelledby="paymentSectionTitle"
      className="grid gap-4 rounded-2xl border border-[var(--border)] bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            className="text-sm font-bold text-[var(--brand-foreground)]"
            id="paymentSectionTitle"
          >
            Pagamento
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--brand-muted)]">
            Use até duas formas diferentes e informe o valor de cada uma.
          </p>
        </div>

        {isSplit ? (
          <button
            className="min-h-10 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--brand-foreground)]"
            onClick={() => onChange([normalizedDrafts[0]!])}
            type="button"
          >
            Remover segunda forma
          </button>
        ) : (
          <button
            className="min-h-10 rounded-xl border border-[var(--brand-accent)] px-3 text-sm font-bold text-[var(--brand-accent-foreground)]"
            disabled={totalInCents <= 0}
            onClick={() => {
              const secondMethod = paymentMethods.find(
                (method) => method !== normalizedDrafts[0]?.method,
              );

              if (!secondMethod) return;

              onChange([
                normalizedDrafts[0] ?? {
                  amountInput: "",
                  method: "cash",
                },
                createDraft(secondMethod),
              ]);
            }}
            type="button"
          >
            Dividir pagamento
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {normalizedDrafts.map((draft, index) => {
          const number = index + 1;
          const methodId = `paymentMethod-${number}`;
          const amountId = `paymentAmount-${number}`;
          const selectedByOtherDraft = normalizedDrafts
            .filter((_, otherIndex) => otherIndex !== index)
            .map((otherDraft) => otherDraft.method);
          const isSingleNonCash = !isSplit && draft.method !== "cash";
          const amountLabel =
            !isSplit && draft.method === "cash"
              ? "Valor recebido"
              : `Valor do pagamento ${number}`;

          return (
            <fieldset
              className="grid min-w-0 gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3"
              key={number}
            >
              <legend className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-muted)]">
                Pagamento {number}
              </legend>

              <label
                className="grid gap-1.5 text-sm font-semibold text-[var(--brand-foreground)]"
                htmlFor={methodId}
              >
                Forma de pagamento {number}
                <select
                  className="h-12 rounded-xl border border-[var(--border)] bg-white px-3 text-base"
                  id={methodId}
                  onChange={(event) =>
                    updateMethod(
                      index,
                      event,
                      normalizedDrafts,
                      onChange,
                      totalInCents,
                    )
                  }
                  value={draft.method}
                >
                  {paymentMethods.map((method) => (
                    <option
                      disabled={selectedByOtherDraft.includes(method)}
                      key={method}
                      value={method}
                    >
                      {paymentMethodLabels[method]}
                    </option>
                  ))}
                </select>
              </label>

              <label
                className="grid gap-1.5 text-sm font-semibold text-[var(--brand-foreground)]"
                htmlFor={amountId}
              >
                {amountLabel}
                <input
                  className="h-12 rounded-xl border border-[var(--border)] bg-white px-3 text-base read-only:bg-neutral-100"
                  id={amountId}
                  inputMode="decimal"
                  onChange={(event) =>
                    updateDraft(
                      index,
                      { amountInput: event.target.value },
                      normalizedDrafts,
                      onChange,
                    )
                  }
                  placeholder="0,00"
                  readOnly={isSingleNonCash}
                  type="text"
                  value={draft.amountInput}
                />
              </label>

              {!isSplit && draft.method === "cash" && totalInCents > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <PaymentShortcut
                    label="Valor exato"
                    onClick={() =>
                      updateDraft(
                        index,
                        { amountInput: formatBrlCentsForInput(totalInCents) },
                        normalizedDrafts,
                        onChange,
                      )
                    }
                  />
                  {[5_000, 10_000].map((amountInCents) => (
                    <PaymentShortcut
                      key={amountInCents}
                      label={moneyFormatter.format(amountInCents / 100)}
                      onClick={() =>
                        updateDraft(
                          index,
                          {
                            amountInput: formatBrlCentsForInput(amountInCents),
                          },
                          normalizedDrafts,
                          onChange,
                        )
                      }
                    />
                  ))}
                </div>
              ) : null}

              {draft.method === "credit_card" ? (
                <div className="grid gap-2">
                  <p
                    className="text-sm font-semibold text-[var(--brand-foreground)]"
                    id={`installments-${number}`}
                  >
                    Parcelas
                  </p>
                  <div
                    aria-labelledby={`installments-${number}`}
                    className="grid grid-cols-3 gap-2"
                    role="radiogroup"
                  >
                    {installmentCounts.map((count) => (
                      <label
                        className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-[var(--border)] bg-white text-sm font-semibold has-[:checked]:border-[var(--brand-accent)] has-[:checked]:bg-[var(--brand-accent)] has-[:checked]:text-[var(--brand-primary)]"
                        key={count}
                      >
                        <input
                          checked={draft.installmentCount === count}
                          className="sr-only"
                          name={`installments-${number}`}
                          onChange={() =>
                            updateDraft(
                              index,
                              { installmentCount: count },
                              normalizedDrafts,
                              onChange,
                            )
                          }
                          type="radio"
                        />
                        {count === 1 ? "À vista" : `${count}x`}
                      </label>
                    ))}
                  </div>
                  {draft.installmentCount && draft.installmentCount > 1 ? (
                    <InstallmentPreview draft={draft} />
                  ) : null}
                </div>
              ) : null}
            </fieldset>
          );
        })}
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm sm:grid-cols-4">
        <PaymentSummaryItem
          label="Total informado"
          value={summary.grossAmountInCents}
        />
        <PaymentSummaryItem
          label="Contribuição líquida"
          value={summary.netAmountInCents}
        />
        <PaymentSummaryItem label="Restante" value={summary.remainingInCents} />
        <PaymentSummaryItem label="Troco" value={summary.changeInCents} />
      </dl>

      {errorMessage || summary.error ? (
        <p className="text-sm font-semibold text-red-700" role="alert">
          {errorMessage ?? summary.error}
        </p>
      ) : null}
    </section>
  );
}

function createDraft(method: PaymentMethod): PaymentDraft {
  return method === "credit_card"
    ? { amountInput: "", installmentCount: 1, method }
    : { amountInput: "", method };
}

function updateMethod(
  index: number,
  event: ChangeEvent<HTMLSelectElement>,
  drafts: PaymentDraft[],
  onChange: (drafts: PaymentDraft[]) => void,
  totalInCents: number,
) {
  const method = event.target.value as PaymentMethod;
  const amountInput =
    drafts.length === 1 && method !== "cash"
      ? formatBrlCentsForInput(Math.max(totalInCents, 0))
      : "";

  updateDraft(
    index,
    method === "credit_card"
      ? { amountInput, installmentCount: 1, method }
      : { amountInput, installmentCount: undefined, method },
    drafts,
    onChange,
  );
}

function updateDraft(
  index: number,
  changes: Partial<PaymentDraft>,
  drafts: PaymentDraft[],
  onChange: (drafts: PaymentDraft[]) => void,
) {
  onChange(
    drafts.map((draft, draftIndex) =>
      draftIndex === index ? { ...draft, ...changes } : draft,
    ),
  );
}

function PaymentShortcut({
  label,
  onClick,
}: {
  label: string;
  onClick(): void;
}) {
  return (
    <button
      className="min-h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function InstallmentPreview({ draft }: { draft: PaymentDraft }) {
  if (!draft.installmentCount || draft.installmentCount === 1) return null;

  const parsedAmountInCents = parseBrlCurrencyToCents(draft.amountInput);
  const amountInCents = Number.isSafeInteger(parsedAmountInCents)
    ? parsedAmountInCents
    : 0;
  const baseInstallment = Math.floor(amountInCents / draft.installmentCount);
  const hasRemainder = amountInCents % draft.installmentCount !== 0;

  return (
    <p className="text-xs leading-5 text-[var(--brand-muted)]">
      {draft.installmentCount} parcelas de aproximadamente{" "}
      {moneyFormatter.format(baseInstallment / 100)}.
      {hasRemainder ? " A última parcela recebe o ajuste de centavos." : ""}
    </p>
  );
}

function PaymentSummaryItem({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[var(--brand-muted)]">
        {label}
      </dt>
      <dd className="mt-1 font-bold text-[var(--brand-foreground)]">
        {moneyFormatter.format(value / 100)}
      </dd>
    </div>
  );
}
