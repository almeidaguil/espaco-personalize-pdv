create type public.cash_session_status as enum (
  'open',
  'closed'
);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  operator_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  opening_amount_in_cents integer not null,
  status public.cash_session_status not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_sessions_opening_amount_not_negative check (
    opening_amount_in_cents >= 0
  ),
  constraint cash_sessions_closed_after_opened check (
    closed_at is null
    or closed_at > opened_at
  ),
  constraint cash_sessions_status_closed_at_consistent check (
    (
      status = 'open'
      and closed_at is null
    )
    or (
      status = 'closed'
      and closed_at is not null
    )
  )
);

create unique index cash_sessions_one_open_per_event_operator_idx
  on public.cash_sessions(event_id, operator_id)
  where status = 'open';

create index cash_sessions_event_idx on public.cash_sessions(event_id);
create index cash_sessions_operator_idx on public.cash_sessions(operator_id);
create index cash_sessions_status_idx on public.cash_sessions(status);
create index cash_sessions_opened_at_idx on public.cash_sessions(opened_at desc);

create trigger cash_sessions_set_updated_at
  before update on public.cash_sessions
  for each row
  execute function public.set_updated_at();

alter table public.cash_sessions enable row level security;

revoke all on public.cash_sessions from anon;
revoke all on public.cash_sessions from authenticated;

grant select, insert, update on public.cash_sessions to authenticated;

create policy "Authenticated users can read cash sessions"
  on public.cash_sessions
  for select
  to authenticated
  using (true);

create policy "Authenticated users can open own cash sessions"
  on public.cash_sessions
  for insert
  to authenticated
  with check (
    operator_id = (select auth.uid())
    and status = 'open'
    and closed_at is null
  );

create policy "Operators can update own cash sessions"
  on public.cash_sessions
  for update
  to authenticated
  using (
    operator_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    operator_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );
