create index sales_cash_session_status_idx
  on public.sales(cash_session_id, status);

create index cash_sessions_report_period_idx
  on public.cash_sessions(business_date desc, opened_at desc, id desc);

alter table public.sales
  add column canceled_after_cash_close boolean not null default false,
  add column canceled_business_date date
    generated always as (
      (canceled_at at time zone 'America/Sao_Paulo')::date
    ) stored;

update public.sales
set canceled_after_cash_close = true
from public.cash_sessions
where sales.cash_session_id = cash_sessions.id
  and sales.status = 'canceled'
  and cash_sessions.closed_at is not null
  and sales.canceled_at > cash_sessions.closed_at;

create index sales_canceled_business_date_operator_idx
  on public.sales(
    canceled_business_date desc,
    operator_id,
    cash_session_id
  )
  where status = 'canceled';

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1
    from auth.users
    join public.profiles
      on profiles.id = auth.users.id
    where auth.users.id = auth.uid()
      and (
        auth.users.banned_until is null
        or auth.users.banned_until <= statement_timestamp()
      )
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1
    from auth.users
    join public.profiles
      on profiles.id = auth.users.id
    where auth.users.id = auth.uid()
      and profiles.role = 'admin'
      and (
        auth.users.banned_until is null
        or auth.users.banned_until <= statement_timestamp()
      )
  );
$$;

revoke all on function public.current_user_is_active() from public;
revoke execute on function public.current_user_is_active() from anon;
grant execute on function public.current_user_is_active() to authenticated;

revoke all on function public.current_user_is_admin() from public;
revoke execute on function public.current_user_is_admin() from anon;
grant execute on function public.current_user_is_admin() to authenticated;

create or replace function public.cancel_sale(
  p_sale_id uuid,
  p_canceled_at timestamptz,
  p_admin_password text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_canceled_at timestamptz;
  v_cash_session record;
  v_sale record;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required to cancel a sale.';
  end if;

  if p_sale_id is null then
    raise exception 'Sale is required.';
  end if;

  if p_canceled_at is null then
    raise exception 'Cancellation date is required.';
  end if;

  if not public.verify_admin_password(p_admin_password) then
    raise exception 'Admin password is required to cancel a sale.';
  end if;

  select id, cash_session_id, operator_id, status
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Sale not found.';
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'Sale is already canceled.';
  end if;

  if v_sale.operator_id <> v_user_id and not exists (
    select 1
    from public.profiles
    where profiles.id = v_user_id
      and profiles.role = 'admin'
  ) then
    raise exception 'User is not allowed to cancel this sale.';
  end if;

  select id, status
  into v_cash_session
  from public.cash_sessions
  where id = v_sale.cash_session_id
  for update;

  if not found then
    raise exception 'Cash session not found.';
  end if;

  v_canceled_at := clock_timestamp();

  update public.sales
  set
    canceled_after_cash_close = v_cash_session.status = 'closed',
    canceled_at = v_canceled_at,
    status = 'canceled'
  where id = p_sale_id
    and status = 'completed';

  if not found then
    raise exception 'Sale is already canceled.';
  end if;

  insert into public.stock_movements (
    id,
    product_id,
    type,
    quantity_change,
    sale_id,
    created_at
  )
  select
    gen_random_uuid(),
    sale_items.product_id,
    'sale_cancellation',
    sale_items.quantity,
    p_sale_id,
    v_canceled_at
  from public.sale_items
  where sale_items.sale_id = p_sale_id;

  if not found then
    raise exception 'Sale has no items to restore.';
  end if;

  return p_sale_id;
end;
$$;

revoke all on function public.cancel_sale(uuid, timestamptz, text) from public;
revoke execute on function public.cancel_sale(uuid, timestamptz, text) from anon;
grant execute on function public.cancel_sale(uuid, timestamptz, text)
  to authenticated;

create or replace function public.close_cash_session(
  p_cash_session_id uuid,
  p_counted_amount_in_cents integer,
  p_closed_at timestamptz,
  p_admin_password text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_cash_session record;
  v_closed_at timestamptz;
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

  v_closed_at := clock_timestamp();

  if v_closed_at <= v_cash_session.opened_at then
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

  if p_counted_amount_in_cents < v_expected_amount_in_cents
    and not public.verify_admin_password(p_admin_password)
  then
    raise exception 'Admin password is required to close a cash session with shortage.';
  end if;

  update public.cash_sessions
  set
    closed_at = v_closed_at,
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

revoke all on function public.close_cash_session(uuid, integer, timestamptz, text)
  from public;
revoke execute on function public.close_cash_session(uuid, integer, timestamptz, text)
  from anon;
grant execute on function public.close_cash_session(uuid, integer, timestamptz, text)
  to authenticated;

create policy "Admins can read operator profiles"
  on public.profiles
  for select
  to authenticated
  using ((select public.current_user_is_admin()));

drop policy if exists "Authenticated users can read own profile"
  on public.profiles;

create policy "Active users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    and (select public.current_user_is_active())
  );

drop policy if exists "Authenticated users can update own profile name"
  on public.profiles;

create policy "Active users can update own profile name"
  on public.profiles
  for update
  to authenticated
  using (
    id = (select auth.uid())
    and (select public.current_user_is_active())
  )
  with check (
    id = (select auth.uid())
    and (select public.current_user_is_active())
  );

drop policy if exists "Users can read allowed cash sessions"
  on public.cash_sessions;

create policy "Active users can read allowed cash sessions"
  on public.cash_sessions
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and (
      operator_id = (select auth.uid())
      or (select public.current_user_is_admin())
    )
  );

drop policy if exists "Users can read allowed sales" on public.sales;

create policy "Active users can read allowed sales"
  on public.sales
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and (
      operator_id = (select auth.uid())
      or (select public.current_user_is_admin())
    )
  );

drop policy if exists "Users can read items from allowed sales"
  on public.sale_items;

create policy "Active users can read items from allowed sales"
  on public.sale_items
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and exists (
      select 1
      from public.sales
      where sales.id = sale_items.sale_id
    )
  );

drop policy if exists "Users can read payments from allowed sales"
  on public.payments;

create policy "Active users can read payments from allowed sales"
  on public.payments
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and exists (
      select 1
      from public.sales
      where sales.id = payments.sale_id
    )
  );

create or replace function public.get_store_sales_report_v2(
  p_start_date date,
  p_end_date date,
  p_operator_id uuid default null,
  p_cash_session_id uuid default null,
  p_items_limit integer default 50,
  p_items_offset integer default 0,
  p_sessions_limit integer default 50,
  p_sessions_offset integer default 0,
  p_export_mode boolean default false
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_is_admin boolean;
  v_report jsonb;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required to generate a sales report.';
  end if;

  if not public.current_user_is_active() then
    raise exception 'An active user is required to generate a sales report.';
  end if;

  v_is_admin := public.current_user_is_admin();

  if p_start_date is null or p_end_date is null then
    raise exception 'The report period is required.';
  end if;

  if p_end_date < p_start_date then
    raise exception 'The report end date cannot precede its start date.';
  end if;

  if p_end_date - p_start_date > 365 then
    raise exception 'The report period cannot exceed 366 days.';
  end if;

  if p_export_mode is null then
    raise exception 'Report export mode is required.';
  end if;

  if p_items_limit is null
    or p_items_limit < 1
    or p_sessions_limit is null
    or p_sessions_limit < 1
  then
    raise exception 'Report page size must be positive.';
  end if;

  if not p_export_mode
    and (p_items_limit > 200 or p_sessions_limit > 200)
  then
    raise exception 'Interactive report page size cannot exceed 200.';
  end if;

  if p_export_mode
    and (p_items_limit > 10000 or p_sessions_limit > 10000)
  then
    raise exception 'Report export cannot exceed 10000 rows per section.';
  end if;

  if p_items_offset is null
    or p_items_offset < 0
    or p_sessions_offset is null
    or p_sessions_offset < 0
  then
    raise exception 'Report page offsets cannot be negative.';
  end if;

  if p_export_mode
    and (p_items_offset <> 0 or p_sessions_offset <> 0)
  then
    raise exception 'Report export offsets must be zero.';
  end if;

  if not v_is_admin
    and p_operator_id is not null
    and p_operator_id <> v_user_id
  then
    raise exception using
      errcode = '42501',
      message = 'Operators can only generate their own sales report.';
  end if;

  if p_cash_session_id is not null and not exists (
    select 1
    from public.cash_sessions
    where cash_sessions.id = p_cash_session_id
      and (v_is_admin or cash_sessions.operator_id = v_user_id)
      and (
        p_operator_id is null
        or cash_sessions.operator_id = p_operator_id
      )
      and (
        cash_sessions.business_date between p_start_date and p_end_date
        or exists (
          select 1
          from public.sales
          where sales.cash_session_id = cash_sessions.id
            and sales.status = 'canceled'
            and sales.canceled_after_cash_close
            and sales.canceled_business_date between p_start_date and p_end_date
        )
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'Cash session is not available for these report filters.';
  end if;

  with accessible_sessions as materialized (
    select
      cash_sessions.id,
      cash_sessions.operator_id,
      coalesce(
        nullif(trim(profiles.full_name), ''),
        profiles.email,
        cash_sessions.operator_id::text
      ) as operator_name,
      cash_sessions.business_date,
      cash_sessions.status,
      cash_sessions.opened_at,
      cash_sessions.closed_at,
      cash_sessions.opening_amount_in_cents,
      cash_sessions.expected_amount_in_cents,
      cash_sessions.counted_amount_in_cents,
      cash_sessions.difference_amount_in_cents
    from public.cash_sessions
    join public.profiles
      on profiles.id = cash_sessions.operator_id
    where cash_sessions.business_date between p_start_date and p_end_date
      and (v_is_admin or cash_sessions.operator_id = v_user_id)
  ),
  accessible_adjustment_sessions as materialized (
    select distinct
      cash_sessions.id,
      cash_sessions.operator_id,
      coalesce(
        nullif(trim(profiles.full_name), ''),
        profiles.email,
        cash_sessions.operator_id::text
      ) as operator_name,
      cash_sessions.business_date,
      cash_sessions.status,
      cash_sessions.opened_at,
      cash_sessions.closed_at,
      cash_sessions.opening_amount_in_cents,
      cash_sessions.expected_amount_in_cents,
      cash_sessions.counted_amount_in_cents,
      cash_sessions.difference_amount_in_cents
    from public.cash_sessions
    join public.profiles
      on profiles.id = cash_sessions.operator_id
    join public.sales
      on sales.cash_session_id = cash_sessions.id
    where sales.status = 'canceled'
      and sales.canceled_after_cash_close
      and sales.canceled_business_date between p_start_date and p_end_date
      and (v_is_admin or cash_sessions.operator_id = v_user_id)
  ),
  all_accessible_sessions as materialized (
    select * from accessible_sessions
    union
    select * from accessible_adjustment_sessions
  ),
  filtered_sessions as materialized (
    select *
    from accessible_sessions
    where (
        p_operator_id is null
        or operator_id = p_operator_id
      )
      and (
        p_cash_session_id is null
        or id = p_cash_session_id
      )
  ),
  filtered_sales as materialized (
    select sales.*
    from public.sales
    join filtered_sessions
      on filtered_sessions.id = sales.cash_session_id
  ),
  recognized_sales as materialized (
    select *
    from filtered_sales
    where status = 'completed'
      or (
        status = 'canceled'
        and canceled_after_cash_close
      )
  ),
  canceled_sales as materialized (
    select *
    from filtered_sales
    where status = 'canceled'
      and (
        not canceled_after_cash_close
      )
  ),
  post_close_adjustments as materialized (
    select sales.*
    from public.sales
    join public.cash_sessions
      on cash_sessions.id = sales.cash_session_id
    where sales.status = 'canceled'
      and sales.canceled_after_cash_close
      and sales.canceled_business_date between p_start_date and p_end_date
      and (v_is_admin or sales.operator_id = v_user_id)
      and (
        p_operator_id is null
        or sales.operator_id = p_operator_id
      )
      and (
        p_cash_session_id is null
        or sales.cash_session_id = p_cash_session_id
      )
  )
  select jsonb_build_object(
    'start_date', p_start_date,
    'end_date', p_end_date,
    'selected_operator_id', p_operator_id,
    'selected_cash_session_id', p_cash_session_id,
    'completed_sales_count', (
      select count(*) from recognized_sales
    ),
    'completed_total_in_cents', coalesce((
      select sum(total_in_cents) from recognized_sales
    ), 0),
    'canceled_sales_count', (
      select count(*) from canceled_sales
    ),
    'canceled_total_in_cents', coalesce((
      select sum(total_in_cents) from canceled_sales
    ), 0),
    'post_close_adjustments_count', (
      select count(*) from post_close_adjustments
    ),
    'post_close_adjustments_total_in_cents', coalesce((
      select sum(total_in_cents) from post_close_adjustments
    ), 0),
    'net_revenue_in_cents',
      coalesce((select sum(total_in_cents) from recognized_sales), 0)
      - coalesce((select sum(total_in_cents) from post_close_adjustments), 0),
    'cash_difference_total_in_cents', coalesce((
      select sum(difference_amount_in_cents)
      from filtered_sessions
      where status = 'closed'
    ), 0),
    'cash_shortage_total_in_cents', coalesce((
      select sum(greatest(-difference_amount_in_cents, 0))
      from filtered_sessions
      where status = 'closed'
    ), 0),
    'cash_surplus_total_in_cents', coalesce((
      select sum(greatest(difference_amount_in_cents, 0))
      from filtered_sessions
      where status = 'closed'
    ), 0),
    'items_limit', p_items_limit,
    'items_offset', p_items_offset,
    'items_total_count', (
      select count(distinct sale_items.product_id)
      from public.sale_items
      join recognized_sales
        on recognized_sales.id = sale_items.sale_id
    ),
    'payment_summary', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'method', payment_totals.method,
          'sales_count', payment_totals.sales_count,
          'net_total_in_cents', payment_totals.net_total_in_cents
        )
        order by payment_totals.sort_order
      )
      from (
        select
          methods.method,
          methods.sort_order,
          count(distinct payments.sale_id)::integer as sales_count,
          coalesce(
            sum(payments.amount_in_cents - payments.change_in_cents),
            0
          )::bigint as net_total_in_cents
        from (
          values
            ('cash'::public.payment_method, 1),
            ('pix'::public.payment_method, 2),
            ('credit_card'::public.payment_method, 3),
            ('debit_card'::public.payment_method, 4)
        ) as methods(method, sort_order)
        left join public.payments
          on payments.method = methods.method
         and exists (
           select 1
           from recognized_sales
           where recognized_sales.id = payments.sale_id
         )
        group by methods.method, methods.sort_order
      ) as payment_totals
    ), '[]'::jsonb),
    'post_close_adjustment_payment_summary', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'method', adjustment_totals.method,
          'sales_count', adjustment_totals.sales_count,
          'net_total_in_cents', adjustment_totals.net_total_in_cents
        )
        order by adjustment_totals.sort_order
      )
      from (
        select
          methods.method,
          methods.sort_order,
          count(distinct payments.sale_id)::integer as sales_count,
          coalesce(
            sum(payments.amount_in_cents - payments.change_in_cents),
            0
          )::bigint as net_total_in_cents
        from (
          values
            ('cash'::public.payment_method, 1),
            ('pix'::public.payment_method, 2),
            ('credit_card'::public.payment_method, 3),
            ('debit_card'::public.payment_method, 4)
        ) as methods(method, sort_order)
        left join public.payments
          on payments.method = methods.method
         and exists (
           select 1
           from post_close_adjustments
           where post_close_adjustments.id = payments.sale_id
         )
        group by methods.method, methods.sort_order
      ) as adjustment_totals
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_id', item_totals.product_id,
          'product_name', item_totals.product_name,
          'quantity', item_totals.quantity,
          'gross_total_in_cents', item_totals.gross_total_in_cents
        )
        order by item_totals.product_name, item_totals.product_id
      )
      from (
        select
          sale_items.product_id,
          (
            array_agg(
              sale_items.product_name
              order by
                recognized_sales.completed_at desc,
                sale_items.sale_id desc
            )
          )[1] as product_name,
          sum(sale_items.quantity)::bigint as quantity,
          sum(sale_items.total_in_cents)::bigint as gross_total_in_cents
        from public.sale_items
        join recognized_sales
          on recognized_sales.id = sale_items.sale_id
        group by sale_items.product_id
        order by
          (
            array_agg(
              sale_items.product_name
              order by
                recognized_sales.completed_at desc,
                sale_items.sale_id desc
            )
          )[1],
          sale_items.product_id
        limit p_items_limit
        offset p_items_offset
      ) as item_totals
    ), '[]'::jsonb),
    'sessions_limit', p_sessions_limit,
    'sessions_offset', p_sessions_offset,
    'sessions_total_count', (
      select count(*) from filtered_sessions
    ),
    'sessions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', session_totals.id,
          'operator_id', session_totals.operator_id,
          'operator_name', session_totals.operator_name,
          'business_date', session_totals.business_date,
          'status', session_totals.status,
          'opened_at', session_totals.opened_at,
          'closed_at', session_totals.closed_at,
          'opening_amount_in_cents', session_totals.opening_amount_in_cents,
          'expected_amount_in_cents', session_totals.expected_amount_in_cents,
          'counted_amount_in_cents', session_totals.counted_amount_in_cents,
          'difference_amount_in_cents', session_totals.difference_amount_in_cents,
          'completed_sales_count', session_totals.completed_sales_count,
          'completed_total_in_cents', session_totals.completed_total_in_cents,
          'canceled_sales_count', session_totals.canceled_sales_count,
          'canceled_total_in_cents', session_totals.canceled_total_in_cents
        )
        order by
          session_totals.business_date desc,
          session_totals.opened_at desc,
          session_totals.id desc
      )
      from (
        select
          filtered_sessions.*,
          count(filtered_sales.id) filter (
            where filtered_sales.status = 'completed'
              or (
                filtered_sales.status = 'canceled'
                and filtered_sales.canceled_after_cash_close
              )
          )::integer as completed_sales_count,
          coalesce(sum(filtered_sales.total_in_cents) filter (
            where filtered_sales.status = 'completed'
              or (
                filtered_sales.status = 'canceled'
                and filtered_sales.canceled_after_cash_close
              )
          ), 0)::bigint as completed_total_in_cents,
          count(filtered_sales.id) filter (
            where filtered_sales.status = 'canceled'
              and not filtered_sales.canceled_after_cash_close
          )::integer as canceled_sales_count,
          coalesce(sum(filtered_sales.total_in_cents) filter (
            where filtered_sales.status = 'canceled'
              and not filtered_sales.canceled_after_cash_close
          ), 0)::bigint as canceled_total_in_cents
        from filtered_sessions
        left join filtered_sales
          on filtered_sales.cash_session_id = filtered_sessions.id
        group by
          filtered_sessions.id,
          filtered_sessions.operator_id,
          filtered_sessions.operator_name,
          filtered_sessions.business_date,
          filtered_sessions.status,
          filtered_sessions.opened_at,
          filtered_sessions.closed_at,
          filtered_sessions.opening_amount_in_cents,
          filtered_sessions.expected_amount_in_cents,
          filtered_sessions.counted_amount_in_cents,
          filtered_sessions.difference_amount_in_cents
        order by
          filtered_sessions.business_date desc,
          filtered_sessions.opened_at desc,
          filtered_sessions.id desc
        limit p_sessions_limit
        offset p_sessions_offset
      ) as session_totals
    ), '[]'::jsonb),
    'operator_options', case
      when p_export_mode then '[]'::jsonb
      else coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', operator_options.operator_id,
            'name', operator_options.operator_name
          )
          order by operator_options.operator_name, operator_options.operator_id
        )
        from (
          select distinct operator_id, operator_name
          from all_accessible_sessions
        ) as operator_options
      ), '[]'::jsonb)
    end,
    'cash_session_options', case
      when p_export_mode then '[]'::jsonb
      else coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', all_accessible_sessions.id,
            'operator_id', all_accessible_sessions.operator_id,
            'operator_name', all_accessible_sessions.operator_name,
            'business_date', all_accessible_sessions.business_date,
            'status', all_accessible_sessions.status,
            'opened_at', all_accessible_sessions.opened_at
          )
          order by
            all_accessible_sessions.business_date desc,
            all_accessible_sessions.opened_at desc,
            all_accessible_sessions.id desc
        )
        from all_accessible_sessions
      ), '[]'::jsonb)
    end
  )
  into v_report;

  if p_export_mode and (
    (v_report ->> 'items_total_count')::bigint > p_items_limit
    or (v_report ->> 'sessions_total_count')::bigint > p_sessions_limit
  ) then
    raise exception 'Report export exceeds the safe row limit.';
  end if;

  return v_report;
end;
$$;

revoke all on function public.get_store_sales_report_v2(
  date,
  date,
  uuid,
  uuid,
  integer,
  integer,
  integer,
  integer,
  boolean
) from public;

revoke execute on function public.get_store_sales_report_v2(
  date,
  date,
  uuid,
  uuid,
  integer,
  integer,
  integer,
  integer,
  boolean
) from anon;

grant execute on function public.get_store_sales_report_v2(
  date,
  date,
  uuid,
  uuid,
  integer,
  integer,
  integer,
  integer,
  boolean
) to authenticated;
