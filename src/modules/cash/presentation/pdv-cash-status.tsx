import { EmptyState } from "@/shared/components/status-state";

export type PdvCashStatusItem = {
  eventName: string;
  id: string;
  openedAtLabel: string;
};

type PdvCashStatusProps = {
  sessions: PdvCashStatusItem[];
};

export function PdvCashStatus({ sessions }: PdvCashStatusProps) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        actions={[
          {
            href: "/cash/open",
            label: "Abrir caixa",
          },
        ]}
        eyebrow="Caixa"
        message="O PDV exige um caixa aberto para registrar vendas, pagamentos e movimentações financeiras."
        title="Abra o caixa antes de vender"
      />
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Caixa
          </p>

          <h2 className="mt-1.5 text-lg font-bold text-[var(--brand-foreground)]">
            Caixa aberto para venda
          </h2>

          <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
            O PDV está liberado para registrar vendas nos caixas abaixo.
          </p>
        </div>

        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Aberto
        </span>
      </div>

      <ul className="mt-4 grid gap-2">
        {sessions.map((session) => (
          <li
            className="rounded-xl border border-emerald-200 bg-white px-4 py-3"
            key={session.id}
          >
            <span className="font-semibold text-[var(--brand-foreground)]">
              {session.eventName}
            </span>

            <span className="mt-1 block text-sm text-[var(--brand-muted)]">
              Aberto em {session.openedAtLabel}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
