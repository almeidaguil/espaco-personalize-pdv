create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_name_not_blank check (length(trim(name)) > 0),
  constraint events_location_length check (
    location is null
    or length(trim(location)) between 1 and 120
  ),
  constraint events_ends_after_starts check (
    ends_at is null
    or ends_at > starts_at
  )
);

create index events_starts_at_idx on public.events(starts_at desc);
create index events_active_idx on public.events(is_active);
create index events_created_by_idx on public.events(created_by);
create index events_name_idx on public.events(lower(name));

create trigger events_set_updated_at
  before update on public.events
  for each row
  execute function public.set_updated_at();

alter table public.events enable row level security;

revoke all on public.events from anon;
revoke all on public.events from authenticated;

grant select, insert, update, delete on public.events to authenticated;

create policy "Authenticated users can read events"
  on public.events
  for select
  to authenticated
  using (true);

create policy "Admins can create events"
  on public.events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "Admins can update events"
  on public.events
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "Admins can delete events"
  on public.events
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );
