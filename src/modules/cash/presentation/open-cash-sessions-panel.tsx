import type { OpenCashSessionOverview } from "../application/open-cash-session-overview-repository";

type OpenCashSessionsPanelProps = {
  sessions: OpenCashSessionOverview[];
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function OpenCashSessionsPanel({
  sessions,
}: OpenCashSessionsPanelProps) {
  return (
    <section aria-labelledby="open-cash-sessions-title" className="grid gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent-foreground)]">
          Acompanhamento
        </p>
        <h2
          className="mt-1.5 text-xl font-bold tracking-tight text-[var(--brand-foreground)]"
          id="open-cash-sessions-title"
        >
          Caixas abertos
        </h2>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--brand-muted)]">
          Nenhum caixa aberto no momento.
        </p>
      ) : (
        <ul className="grid gap-3">
          {sessions.map((session) => (
            <li
              className="rounded-xl border border-[var(--border)] bg-[var(--brand-surface)] px-4 py-3"
              key={session.id}
            >
              <p className="font-semibold text-[var(--brand-foreground)]">
                {session.operatorName}
              </p>
              <p className="mt-1 text-sm text-[var(--brand-muted)]">
                Aberto em {dateFormatter.format(session.openedAt)} · ID{" "}
                {session.id.slice(0, 8)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
