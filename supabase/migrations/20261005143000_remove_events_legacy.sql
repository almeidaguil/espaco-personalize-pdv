-- Remove event dependencies only after the PR05 operator/session cut.
begin;

create or replace function public.finalize_sale_v3(
  p_sale_id uuid,
  p_cash_session_id uuid,
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

  if not public.current_user_is_active() then
    raise exception 'An active user is required to finalize a sale.';
  end if;

  if p_cash_session_id is null then
    raise exception 'Cash session is required.';
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
    extensions.digest(
      p_cash_session_id::text || '|' || p_items::text || '|' || p_payment::text,
      'sha256'
    ),
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

  select id
  into v_cash_session
  from public.cash_sessions
  where id = p_cash_session_id
    and operator_id = v_user_id
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
    cash_session_id,
    operator_id,
    status,
    total_in_cents,
    completed_at,
    request_fingerprint
  )
  values (
    p_sale_id,
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

revoke all on function public.finalize_sale_v3(uuid, uuid, jsonb, jsonb) from public;
revoke execute on function public.finalize_sale_v3(uuid, uuid, jsonb, jsonb) from anon;
grant execute on function public.finalize_sale_v3(uuid, uuid, jsonb, jsonb)
  to authenticated;

drop trigger cash_sessions_prepare_legacy_insert on public.cash_sessions;
drop trigger sales_prepare_insert on public.sales;

drop function public.prepare_legacy_cash_session_insert();
drop function public.prepare_sale_insert();
drop function public.close_event(uuid);
drop function public.open_cash_session_v2(integer, uuid);
drop function public.finalize_sale_v2(uuid, jsonb, jsonb);
drop function public.finalize_sale(
  uuid, uuid, uuid, timestamptz, jsonb, jsonb, integer
);

drop index public.cash_sessions_one_open_per_event_operator_idx;
drop index public.cash_sessions_event_idx;
drop index public.sales_event_completed_at_idx;

alter table public.cash_sessions
  drop constraint cash_sessions_event_id_fkey;
alter table public.sales
  drop constraint sales_event_id_fkey;

alter table public.cash_sessions drop column event_id;
alter table public.sales drop column event_id;

-- No CASCADE: unexpected dependencies must abort the entire transaction.
drop table public.events;

notify pgrst, 'reload schema';
commit;
