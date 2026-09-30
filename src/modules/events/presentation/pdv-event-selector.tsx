import { Panel } from "@/shared/components/panel";

export type PdvEventSelectorItem = {
  id: string;
  location: string | null;
  name: string;
  startsAtLabel: string;
};

type PdvEventSelectorProps = {
  events: PdvEventSelectorItem[];
};

export function PdvEventSelector({ events }: PdvEventSelectorProps) {
  const activeEvent = events[0];

  if (!activeEvent) {
    return null;
  }

  return (
    <Panel>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent)]">
          Evento
        </p>

        <h2 className="mt-1.5 text-lg font-bold text-[var(--brand-foreground)]">
          Evento ativo da operação
        </h2>

        <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
          As vendas ficam vinculadas ao caixa aberto deste evento.
        </p>
      </div>

      <article className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--brand-foreground)]">
              {activeEvent.name}
            </h3>

            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              {activeEvent.location ?? "Sem local"}
            </p>
          </div>

          <span className="text-sm font-semibold text-[#9a7021]">
            {activeEvent.startsAtLabel}
          </span>
        </div>
      </article>
    </Panel>
  );
}
