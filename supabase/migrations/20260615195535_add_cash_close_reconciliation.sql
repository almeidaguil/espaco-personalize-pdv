alter table public.cash_sessions
  add column counted_amount_in_cents integer,
  add column expected_amount_in_cents integer,
  add column difference_amount_in_cents integer,
  add column closed_by uuid references auth.users(id) on delete set null;

update public.cash_sessions
set
  closed_by = operator_id,
  expected_amount_in_cents =
    opening_amount_in_cents + coalesce((
      select sum(payments.amount_in_cents - payments.change_in_cents)
      from public.sales
      join public.payments
        on payments.sale_id = sales.id
      where sales.cash_session_id = cash_sessions.id
        and sales.status = 'completed'
        and payments.method = 'cash'
    ), 0),
  counted_amount_in_cents =
    opening_amount_in_cents + coalesce((
      select sum(payments.amount_in_cents - payments.change_in_cents)
      from public.sales
      join public.payments
        on payments.sale_id = sales.id
      where sales.cash_session_id = cash_sessions.id
        and sales.status = 'completed'
        and payments.method = 'cash'
    ), 0),
  difference_amount_in_cents = 0
where status = 'closed';

alter table public.cash_sessions
  add constraint cash_sessions_counted_amount_not_negative check (
    counted_amount_in_cents is null
    or counted_amount_in_cents >= 0
  ),
  add constraint cash_sessions_expected_amount_not_negative check (
    expected_amount_in_cents is null
    or expected_amount_in_cents >= 0
  ),
  add constraint cash_sessions_closing_amounts_required_when_closed check (
    (
      status = 'open'
      and counted_amount_in_cents is null
      and expected_amount_in_cents is null
      and difference_amount_in_cents is null
      and closed_by is null
    )
    or (
      status = 'closed'
      and counted_amount_in_cents is not null
      and expected_amount_in_cents is not null
      and difference_amount_in_cents is not null
      and closed_by is not null
    )
  );

create index cash_sessions_closed_by_idx on public.cash_sessions(closed_by);

create or replace function public.close_cash_session(
  p_cash_session_id uuid,
  p_counted_amount_in_cents integer,
  p_closed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cash_session record;
  v_completed_sales_total_in_cents integer := 0;
  v_expected_amount_in_cents integer := 0;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required to close a cash session.';
  end if;

  if p_cash_session_id is null then
    raise exception 'Cash session is required.';
  end if;

  if p_counted_amount_in_cents is null or p_counted_amount_in_cents < 0 then
    raise exception 'Counted amount must be zero or greater.';
  end if;

  if p_closed_at is null then
    raise exception 'Closing date is required.';
  end if;

  select id, operator_id, opening_amount_in_cents, opened_at, status
  into v_cash_session
  from public.cash_sessions
  where id = p_cash_session_id
  for update;

  if not found then
    raise exception 'Cash session not found.';
  end if;

  if v_cash_session.status <> 'open' then
    raise exception 'Cash session is already closed.';
  end if;

  if p_closed_at <= v_cash_session.opened_at then
    raise exception 'Cash session close date must be after open date.';
  end if;

  if v_cash_session.operator_id <> v_user_id and not exists (
    select 1
    from public.profiles
    where profiles.id = v_user_id
      and profiles.role = 'admin'
  ) then
    raise exception 'User is not allowed to close this cash session.';
  end if;

  select coalesce(sum(payments.amount_in_cents - payments.change_in_cents), 0)
  into v_completed_sales_total_in_cents
  from public.sales
  join public.payments
    on payments.sale_id = sales.id
  where sales.cash_session_id = p_cash_session_id
    and sales.status = 'completed'
    and payments.method = 'cash';

  v_expected_amount_in_cents :=
    v_cash_session.opening_amount_in_cents + v_completed_sales_total_in_cents;

  update public.cash_sessions
  set
    closed_at = p_closed_at,
    closed_by = v_user_id,
    counted_amount_in_cents = p_counted_amount_in_cents,
    difference_amount_in_cents = p_counted_amount_in_cents - v_expected_amount_in_cents,
    expected_amount_in_cents = v_expected_amount_in_cents,
    status = 'closed'
  where id = p_cash_session_id
    and status = 'open';

  if not found then
    raise exception 'Cash session is already closed.';
  end if;

  return p_cash_session_id;
end;
$$;

revoke all on function public.close_cash_session(
  uuid,
  integer,
  timestamptz
) from public;

revoke execute on function public.close_cash_session(
  uuid,
  integer,
  timestamptz
) from anon;

grant execute on function public.close_cash_session(
  uuid,
  integer,
  timestamptz
) to authenticated;
