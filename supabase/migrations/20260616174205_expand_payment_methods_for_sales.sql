alter type public.payment_method add value if not exists 'pix';
alter type public.payment_method add value if not exists 'credit_card';
alter type public.payment_method add value if not exists 'debit_card';

create or replace function public.finalize_sale(
  p_sale_id uuid,
  p_event_id uuid,
  p_cash_session_id uuid,
  p_completed_at timestamptz,
  p_items jsonb,
  p_payment jsonb,
  p_total_in_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount_in_cents integer;
  v_balance integer;
  v_change_in_cents integer;
  v_item record;
  v_item_count integer;
  v_joined_item_count integer;
  v_payment_method text;
  v_total_in_cents integer := 0;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required to finalize a sale.';
  end if;

  if p_sale_id is null or p_event_id is null or p_cash_session_id is null then
    raise exception 'Sale, event and cash session are required.';
  end if;

  if p_completed_at is null then
    raise exception 'Sale completion date is required.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Sale must have at least one item.';
  end if;

  perform 1
  from public.cash_sessions
  where id = p_cash_session_id
    and event_id = p_event_id
    and operator_id = v_user_id
    and status = 'open'
  for update;

  if not found then
    raise exception 'There is no open cash session for this sale.';
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

    v_total_in_cents := v_total_in_cents + (v_item.quantity * v_item.price_in_cents);
  end loop;

  if p_total_in_cents <> v_total_in_cents then
    raise exception 'Sale total does not match current product prices.';
  end if;

  v_payment_method := p_payment ->> 'method';
  v_amount_in_cents := nullif(p_payment ->> 'amount_in_cents', '')::integer;
  v_change_in_cents := nullif(p_payment ->> 'change_in_cents', '')::integer;

  if v_payment_method not in ('cash', 'pix', 'credit_card', 'debit_card') then
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
    completed_at
  )
  values (
    p_sale_id,
    p_event_id,
    p_cash_session_id,
    v_user_id,
    'completed',
    v_total_in_cents,
    p_completed_at
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
      p_completed_at
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
