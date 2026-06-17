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
        actions={[{ href: "/cash/open", label: "Abrir caixa" }]}
        eyebrow="Caixa"
        message="O PDV exige um caixa aberto para registrar vendas, pagamentos e movimentacoes financeiras."
        title="Abra o caixa antes de vender"
      />
    );
  }

  return (
    <section className="rounded-md border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
        Caixa
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-950">
        Caixa aberto para venda
      </h2>
      <ul className="mt-3 grid gap-2">
        {sessions.map((session) => (
          <li
            className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700"
            key={session.id}
          >
            <span className="font-semibold text-slate-950">
              {session.eventName}
            </span>
            <span className="block">Aberto em {session.openedAtLabel}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
