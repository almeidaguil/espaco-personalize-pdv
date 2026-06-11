import Link from "next/link";

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
      <section className="rounded-md border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
          Caixa
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          Abra o caixa antes de vender
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          O PDV exige um caixa aberto para registrar vendas, pagamentos e
          movimentacoes financeiras.
        </p>
        <Link
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#1e3275] px-4 text-sm font-semibold text-white transition hover:bg-[#17275c]"
          href="/cash/open"
        >
          Abrir caixa
        </Link>
      </section>
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
