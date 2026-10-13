do $$
begin
  if exists (
    select 1
    from public.cash_sessions
    where status = 'open'
    group by operator_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'Cannot enforce one open cash session per operator while duplicate open sessions exist.';
  end if;
end;
$$;

alter table public.cash_sessions
  alter column event_id drop not null,
  add column business_date date
    generated always as (
      (opened_at at time zone 'America/Sao_Paulo')::date
    ) stored not null;

alter table public.sales
  alter column event_id drop not null,
  add column request_fingerprint text,
  add constraint sales_request_fingerprint_format check (
    request_fingerprint is null
    or request_fingerprint ~ '^[0-9a-f]{64}$'
  );

create unique index cash_sessions_one_open_per_operator_idx
  on public.cash_sessions(operator_id)
  where status = 'open';

create index cash_sessions_business_date_operator_idx
  on public.cash_sessions(business_date desc, operator_id, opened_at desc);

create index cash_sessions_operator_business_date_opened_at_idx
  on public.cash_sessions(operator_id, business_date, opened_at desc);

create index cash_sessions_status_opened_at_idx
  on public.cash_sessions(status, opened_at desc);

create index sales_completed_at_idx
  on public.sales(completed_at desc);

create index sales_operator_completed_at_idx
  on public.sales(operator_id, completed_at desc);

create index sales_cash_session_completed_at_idx
  on public.sales(cash_session_id, completed_at desc);

create or replace function public.prepare_legacy_cash_session_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_opened_at timestamptz := statement_timestamp();
  v_user_id uuid := auth.uid();
begin
  if v_user_id is not null then
    if not exists (
      select 1
      from auth.users
      join public.profiles
        on profiles.id = auth.users.id
      where auth.users.id = v_user_id
        and (
          auth.users.banned_until is null
          or auth.users.banned_until <= v_opened_at
        )
    ) then
      raise exception 'An active user is required to open a cash session.';
    end if;

    if new.event_id is not null then
      perform 1
      from public.events
      where events.id = new.event_id
        and events.is_active = true
      for update;

      if not found then
        raise exception 'Active event not found.';
      end if;
    end if;

    new.operator_id := v_user_id;
    new.status := 'open';
    new.opened_at := v_opened_at;
    new.closed_at := null;
    new.closed_by := null;
    new.counted_amount_in_cents := null;
    new.expected_amount_in_cents := null;
    new.difference_amount_in_cents := null;
    new.created_at := v_opened_at;
    new.updated_at := v_opened_at;
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_legacy_cash_session_insert() from public;
revoke execute on function public.prepare_legacy_cash_session_insert() from anon;
revoke execute on function public.prepare_legacy_cash_session_insert() from authenticated;

create trigger cash_sessions_prepare_legacy_insert
  before insert on public.cash_sessions
  for each row
  execute function public.prepare_legacy_cash_session_insert();

revoke update, delete on public.cash_sessions from authenticated;

drop policy if exists "Authenticated users can read cash sessions"
  on public.cash_sessions;
drop policy if exists "Authenticated users can open own cash sessions"
  on public.cash_sessions;
drop policy if exists "Operators can update own cash sessions"
  on public.cash_sessions;

create policy "Users can read allowed cash sessions"
  on public.cash_sessions
  for select
  to authenticated
  using (
    operator_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

-- Kept only while the event-based runtime opens cash sessions with INSERT.
-- Target sessions without an event must use open_cash_session_v2.
create policy "Users can open own legacy cash sessions"
  on public.cash_sessions
  for insert
  to authenticated
  with check (
    operator_id = (select auth.uid())
    and event_id is not null
    and exists (
      select 1
      from public.events
      where events.id = cash_sessions.event_id
        and events.is_active = true
    )
    and status = 'open'
    and closed_at is null
    and closed_by is null
    and counted_amount_in_cents is null
    and expected_amount_in_cents is null
    and difference_amount_in_cents is null
  );

drop policy if exists "Authenticated users can read sales" on public.sales;
drop policy if exists "Authenticated users can read sale items"
  on public.sale_items;
drop policy if exists "Authenticated users can read payments"
  on public.payments;

create policy "Users can read allowed sales"
  on public.sales
  for select
  to authenticated
  using (
    operator_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "Users can read items from allowed sales"
  on public.sale_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sales
      where sales.id = sale_items.sale_id
    )
  );

create policy "Users can read payments from allowed sales"
  on public.payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sales
      where sales.id = payments.sale_id
    )
  );

create or replace function public.open_cash_session_v2(
  p_opening_amount_in_cents integer,
  p_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_cash_session_id uuid;
  v_opened_at timestamptz := statement_timestamp();
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required to open a cash session.';
  end if;

  if not exists (
    select 1
    from auth.users
    join public.profiles
      on profiles.id = auth.users.id
    where auth.users.id = v_user_id
      and (
        auth.users.banned_until is null
        or auth.users.banned_until <= v_opened_at
      )
  ) then
    raise exception 'An active user is required to open a cash session.';
  end if;

  if p_opening_amount_in_cents is null or p_opening_amount_in_cents < 0 then
    raise exception 'Opening amount must be zero or greater.';
  end if;

  if p_event_id is not null and not exists (
    select 1
    from public.events
    where events.id = p_event_id
      and events.is_active = true
  ) then
    raise exception 'Active event not found.';
  end if;

  insert into public.cash_sessions (
    event_id,
    operator_id,
    opening_amount_in_cents,
    status,
    opened_at
  )
  values (
    p_event_id,
    v_user_id,
    p_opening_amount_in_cents,
    'open',
    v_opened_at
  )
  returning id into v_cash_session_id;

  return v_cash_session_id;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'An open cash session already exists for this operator.';
end;
$$;

revoke all on function public.open_cash_session_v2(integer, uuid) from public;
revoke execute on function public.open_cash_session_v2(integer, uuid) from anon;
grant execute on function public.open_cash_session_v2(integer, uuid)
  to authenticated;

create or replace function public.finalize_sale_v2(
  p_sale_id uuid,
  p_items jsonb,
  p_payment jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_amount_in_cents integer;
  v_balance integer;
  v_cash_session record;
  v_change_in_cents integer;
  v_completed_at timestamptz := statement_timestamp();
  v_item record;
  v_item_count integer;
  v_joined_item_count integer;
  v_existing_request_fingerprint text;
  v_payment_method text;
  v_existing_operator_id uuid;
  v_request_fingerprint text;
  v_total_in_cents integer := 0;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required to finalize a sale.';
  end if;

  if p_sale_id is null then
    raise exception 'Sale identifier is required.';
  end if;

  if not exists (
    select 1
    from auth.users
    join public.profiles
      on profiles.id = auth.users.id
    where auth.users.id = v_user_id
      and (
        auth.users.banned_until is null
        or auth.users.banned_until <= v_completed_at
      )
  ) then
    raise exception 'An active user is required to finalize a sale.';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'Sale must have at least one item.';
  end if;

  if p_payment is null or jsonb_typeof(p_payment) <> 'object' then
    raise exception 'Sale payment is required.';
  end if;

  v_request_fingerprint := encode(
    extensions.digest(p_items::text || '|' || p_payment::text, 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('sale:' || p_sale_id::text, 0)
  );

  select operator_id, request_fingerprint
  into v_existing_operator_id, v_existing_request_fingerprint
  from public.sales
  where id = p_sale_id;

  if found then
    if v_existing_operator_id = v_user_id
      and v_existing_request_fingerprint = v_request_fingerprint
    then
      return p_sale_id;
    end if;

    if v_existing_operator_id = v_user_id then
      raise exception 'Sale identifier was reused with a different payload.';
    end if;

    raise exception 'Sale identifier is unavailable.';
  end if;

  select id, event_id
  into v_cash_session
  from public.cash_sessions
  where operator_id = v_user_id
    and status = 'open'
  for update;

  if not found then
    raise exception 'There is no open cash session for this sale.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      product_id uuid,
      quantity integer
    )
    where item.product_id is null
       or item.quantity is null
       or item.quantity <= 0
  ) then
    raise exception 'Sale items must have valid products and positive quantities.';
  end if;

  with raw_items as (
    select
      item.product_id,
      sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(
      product_id uuid,
      quantity integer
    )
    group by item.product_id
  )
  select count(*)
  into v_item_count
  from raw_items;

  with raw_items as (
    select
      item.product_id,
      sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(
      product_id uuid,
      quantity integer
    )
    group by item.product_id
  )
  select count(*)
  into v_joined_item_count
  from raw_items
  join public.products
    on products.id = raw_items.product_id
   and products.is_active = true;

  if v_item_count <> v_joined_item_count then
    raise exception 'Product unavailable for sale.';
  end if;

  for v_item in
    with raw_items as (
      select
        item.product_id,
        sum(item.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) as item(
        product_id uuid,
        quantity integer
      )
      group by item.product_id
    )
    select
      products.id as product_id,
      products.name as product_name,
      products.price_in_cents,
      raw_items.quantity
    from raw_items
    join public.products
      on products.id = raw_items.product_id
     and products.is_active = true
    order by products.id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_item.product_id::text, 0));

    select coalesce(sum(quantity_change), 0)
    into v_balance
    from public.stock_movements
    where product_id = v_item.product_id;

    if v_balance < v_item.quantity then
      raise exception 'Insufficient stock for product %.', v_item.product_name;
    end if;

    v_total_in_cents :=
      v_total_in_cents + (v_item.quantity * v_item.price_in_cents);
  end loop;

  v_payment_method := p_payment ->> 'method';
  v_amount_in_cents := nullif(p_payment ->> 'amount_in_cents', '')::integer;
  v_change_in_cents := nullif(p_payment ->> 'change_in_cents', '')::integer;

  if v_payment_method is null
    or v_payment_method not in ('cash', 'pix', 'credit_card', 'debit_card')
  then
    raise exception 'Unsupported payment method.';
  end if;

  if v_amount_in_cents is null or v_change_in_cents is null then
    raise exception 'Payment amount and change are required.';
  end if;

  if v_amount_in_cents < 0 or v_change_in_cents < 0 then
    raise exception 'Payment amount and change cannot be negative.';
  end if;

  if v_payment_method = 'cash' then
    if v_amount_in_cents - v_change_in_cents <> v_total_in_cents then
      raise exception 'Payment amount and change do not match sale total.';
    end if;
  else
    if v_change_in_cents <> 0 then
      raise exception 'Non-cash payments cannot register change.';
    end if;

    if v_amount_in_cents <> v_total_in_cents then
      raise exception 'Non-cash payments must match the sale total.';
    end if;
  end if;

  insert into public.sales (
    id,
    event_id,
    cash_session_id,
    operator_id,
    status,
    total_in_cents,
    completed_at,
    request_fingerprint
  )
  values (
    p_sale_id,
    v_cash_session.event_id,
    v_cash_session.id,
    v_user_id,
    'completed',
    v_total_in_cents,
    v_completed_at,
    v_request_fingerprint
  );

  for v_item in
    with raw_items as (
      select
        item.product_id,
        sum(item.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) as item(
        product_id uuid,
        quantity integer
      )
      group by item.product_id
    )
    select
      products.id as product_id,
      products.name as product_name,
      products.price_in_cents,
      raw_items.quantity
    from raw_items
    join public.products
      on products.id = raw_items.product_id
     and products.is_active = true
    order by products.id
  loop
    insert into public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price_in_cents,
      total_in_cents
    )
    values (
      p_sale_id,
      v_item.product_id,
      v_item.product_name,
      v_item.quantity,
      v_item.price_in_cents,
      v_item.quantity * v_item.price_in_cents
    );

    insert into public.stock_movements (
      id,
      product_id,
      type,
      quantity_change,
      sale_id,
      created_at
    )
    values (
      gen_random_uuid(),
      v_item.product_id,
      'sale',
      -v_item.quantity,
      p_sale_id,
      v_completed_at
    );
  end loop;

  insert into public.payments (
    sale_id,
    method,
    amount_in_cents,
    change_in_cents
  )
  values (
    p_sale_id,
    v_payment_method::public.payment_method,
    v_amount_in_cents,
    v_change_in_cents
  );

  return p_sale_id;
end;
$$;

revoke all on function public.finalize_sale_v2(uuid, jsonb, jsonb) from public;
revoke execute on function public.finalize_sale_v2(uuid, jsonb, jsonb) from anon;
grant execute on function public.finalize_sale_v2(uuid, jsonb, jsonb)
  to authenticated;

create or replace function public.prepare_sale_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_cash_session record;
  v_completed_at timestamptz := statement_timestamp();
  v_user_id uuid := auth.uid();
begin
  if v_user_id is not null then
    if not exists (
      select 1
      from auth.users
      join public.profiles
        on profiles.id = auth.users.id
      where auth.users.id = v_user_id
        and (
          auth.users.banned_until is null
          or auth.users.banned_until <= v_completed_at
        )
    ) then
      raise exception 'An active user is required to finalize a sale.';
    end if;

    select id, event_id
    into v_cash_session
    from public.cash_sessions
    where id = new.cash_session_id
      and operator_id = v_user_id
      and status = 'open'
    for update;

    if not found then
      raise exception 'There is no open cash session for this sale.';
    end if;

    new.event_id := v_cash_session.event_id;
    new.operator_id := v_user_id;
    new.completed_at := v_completed_at;
    new.created_at := v_completed_at;
    new.updated_at := v_completed_at;
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_sale_insert() from public;
revoke execute on function public.prepare_sale_insert() from anon;
revoke execute on function public.prepare_sale_insert() from authenticated;

create trigger sales_prepare_insert
  before insert on public.sales
  for each row
  execute function public.prepare_sale_insert();

alter function public.finalize_sale(
  uuid,
  uuid,
  uuid,
  timestamptz,
  jsonb,
  jsonb,
  integer
) set search_path to pg_catalog, public, pg_temp;

alter function public.cancel_sale(uuid, timestamptz, text)
  set search_path to pg_catalog, public, pg_temp;

alter function public.close_cash_session(uuid, integer, timestamptz, text)
  set search_path to pg_catalog, public, pg_temp;

alter function public.verify_admin_password(text)
  set search_path to pg_catalog, public, auth, extensions, pg_temp;

revoke all on function public.finalize_sale(
  uuid,
  uuid,
  uuid,
  timestamptz,
  jsonb,
  jsonb,
  integer
) from public;
revoke execute on function public.finalize_sale(
  uuid,
  uuid,
  uuid,
  timestamptz,
  jsonb,
  jsonb,
  integer
) from anon;
grant execute on function public.finalize_sale(
  uuid,
  uuid,
  uuid,
  timestamptz,
  jsonb,
  jsonb,
  integer
) to authenticated;

revoke all on function public.cancel_sale(uuid, timestamptz, text) from public;
revoke execute on function public.cancel_sale(uuid, timestamptz, text) from anon;
grant execute on function public.cancel_sale(uuid, timestamptz, text)
  to authenticated;

revoke all on function public.close_cash_session(
  uuid,
  integer,
  timestamptz,
  text
) from public;
revoke execute on function public.close_cash_session(
  uuid,
  integer,
  timestamptz,
  text
) from anon;
grant execute on function public.close_cash_session(
  uuid,
  integer,
  timestamptz,
  text
) to authenticated;

revoke all on function public.verify_admin_password(text) from public;
revoke execute on function public.verify_admin_password(text) from anon;
revoke execute on function public.verify_admin_password(text)
  from authenticated;
