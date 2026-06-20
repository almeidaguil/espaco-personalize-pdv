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
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
          Evento
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          Evento ativo da operacao
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          As vendas ficam vinculadas ao caixa aberto deste evento.
        </p>
      </div>

      <article className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
        <h3 className="text-sm font-semibold text-slate-950">
          {activeEvent.name}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          {activeEvent.location ?? "Sem local"} - {activeEvent.startsAtLabel}
        </p>
      </article>
    </Panel>
  );
}
