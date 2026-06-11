export type EventListItem = {
  id: string;
  isActive: boolean;
  location: string | null;
  name: string;
  periodLabel: string;
};

type EventListProps = {
  events: EventListItem[];
};

export function EventList({ events }: EventListProps) {
  return (
    <ul className="grid gap-3">
      {events.map((event) => (
        <li
          className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
          key={event.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {event.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {event.location ?? "Sem local"}
              </p>
            </div>
            <span
              className={
                event.isActive
                  ? "rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                  : "rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
              }
            >
              {event.isActive ? "Ativo" : "Inativo"}
            </span>
          </div>

          <strong className="mt-4 block text-sm text-[#1e3275]">
            {event.periodLabel}
          </strong>
        </li>
      ))}
    </ul>
  );
}
