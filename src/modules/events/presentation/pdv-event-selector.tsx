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
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
          Evento
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          Selecione o evento da venda
        </h2>
      </div>

      <div className="grid gap-3">
        {events.map((event, index) => (
          <label
            className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 transition hover:border-[#1e3275]/40"
            key={event.id}
          >
            <input
              className="mt-1 h-4 w-4 border-slate-300 text-[#1e3275] focus:ring-[#1e3275]"
              defaultChecked={index === 0}
              name="eventId"
              type="radio"
              value={event.id}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-950">
                {event.name}
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                {event.location ?? "Sem local"} · {event.startsAtLabel}
              </span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
