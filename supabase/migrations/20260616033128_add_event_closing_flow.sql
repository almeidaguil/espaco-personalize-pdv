with active_events_ranked as (
  select
    id,
    row_number() over (
      order by starts_at desc, updated_at desc, created_at desc, id desc
    ) as active_position
  from public.events
  where is_active = true
)
update public.events
set is_active = false
from active_events_ranked
where events.id = active_events_ranked.id
  and active_events_ranked.active_position > 1;

create unique index events_single_active_idx
  on public.events((is_active))
  where is_active = true;

create or replace function public.close_event(
  p_event_id uuid
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_event record;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required to close an event.';
  end if;

  if p_event_id is null then
    raise exception 'Event is required.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = v_user_id
      and profiles.role = 'admin'
  ) then
    raise exception 'Only admins can close events.';
  end if;

  select id, is_active
  into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found.';
  end if;

  if v_event.is_active = false then
    raise exception 'Event is already closed.';
  end if;

  if exists (
    select 1
    from public.cash_sessions
    where cash_sessions.event_id = p_event_id
      and cash_sessions.status = 'open'
  ) then
    raise exception 'Event has open cash sessions.';
  end if;

  update public.events
  set is_active = false
  where id = p_event_id
    and is_active = true;

  if not found then
    raise exception 'Event is already closed.';
  end if;

  return p_event_id;
end;
$$;

revoke all on function public.close_event(uuid) from public;
revoke execute on function public.close_event(uuid) from anon;
grant execute on function public.close_event(uuid) to authenticated;
