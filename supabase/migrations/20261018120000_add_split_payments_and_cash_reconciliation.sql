begin;

do $$
begin
  if exists (
    select 1
    from public.payments
    group by sale_id, method
    having count(*) > 1
  ) then
    raise exception using
      message = 'Split payment migration found duplicate payment methods for a sale.',
      hint = 'Consolidate duplicate methods into one audited payment before retrying.';
  end if;

  if exists (
    select 1
    from public.payments
    where amount_in_cents <= 0
      or change_in_cents >= amount_in_cents
      or (method <> 'cash' and change_in_cents <> 0)
  ) then
    raise exception using
      message = 'Split payment migration requires positive net payment amounts.',
      hint = 'Audit zero-value, zero-net and non-cash change rows before retrying.';
  end if;
end;
$$;

alter table public.payments
  add column installment_count smallint;

update public.payments
set installment_count = 1
where method = 'credit_card';

alter table public.payments
  add constraint payments_sale_method_unique unique (sale_id, method),
  add constraint payments_amount_positive_v2 check (amount_in_cents > 0),
  add constraint payments_change_only_cash check (
    method = 'cash' or change_in_cents = 0
  ),
  add constraint payments_net_amount_positive check (
    amount_in_cents - change_in_cents >= 1
  ),
  add constraint payments_installment_matches_method check (
    (
      method = 'credit_card'
      and installment_count between 1 and 3
    )
    or (
      method <> 'credit_card'
      and installment_count is null
    )
  );

-- Keep the deployed v3/v4 wrappers working while the application moves to
-- v5. Their single credit payment is canonically an à-vista payment.
do $compatibility$
declare
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(
    'public.finalize_sale_transaction(uuid,uuid,jsonb,jsonb,integer,text)'::regprocedure
  )
  into v_definition;

  v_updated_definition := replace(
    v_definition,
    $old_payment$  insert into public.payments (
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
  );$old_payment$,
    $new_payment$  insert into public.payments (
    sale_id,
    method,
    amount_in_cents,
    change_in_cents,
    installment_count
  )
  values (
    p_sale_id,
    v_payment_method::public.payment_method,
    v_amount_in_cents,
    v_change_in_cents,
    case when v_payment_method = 'credit_card' then 1 else null end
  );$new_payment$
  );

  if v_updated_definition = v_definition then
    raise exception 'Could not install legacy credit installment compatibility.';
  end if;

  execute v_updated_definition;
end;
$compatibility$;

create table public.cash_session_reconciliations (
  cash_session_id uuid not null
    references public.cash_sessions(id) on delete restrict,
  method public.payment_method not null,
  expected_amount_in_cents integer not null,
  counted_amount_in_cents integer not null,
  difference_amount_in_cents integer not null,
  created_at timestamptz not null default now(),
  constraint cash_session_reconciliations_pkey
    primary key (cash_session_id, method),
  constraint cash_session_reconciliations_expected_nonnegative
    check (expected_amount_in_cents >= 0),
  constraint cash_session_reconciliations_counted_nonnegative
    check (counted_amount_in_cents >= 0),
  constraint cash_session_reconciliations_difference_matches
    check (
      difference_amount_in_cents =
        counted_amount_in_cents - expected_amount_in_cents
    )
);

alter table public.cash_session_reconciliations enable row level security;

revoke all on public.cash_session_reconciliations from public, anon, authenticated;
grant select on public.cash_session_reconciliations to authenticated;

create policy "Active users can read allowed cash reconciliations"
  on public.cash_session_reconciliations
  for select
  to authenticated
  using (
    public.current_user_is_active()
    and exists (
      select 1
      from public.cash_sessions
      where cash_sessions.id = cash_session_reconciliations.cash_session_id
        and (
          cash_sessions.operator_id = (select auth.uid())
          or public.current_user_is_admin()
        )
    )
  );

create or replace function public.finalize_sale_payments_transaction(
  p_sale_id uuid,
  p_cash_session_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_discount_in_cents integer,
  p_request_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_balance integer;
  v_cash_amount_in_cents integer;
  v_cash_session record;
  v_change_in_cents integer := 0;
  v_completed_at timestamptz := statement_timestamp();
  v_existing_operator_id uuid;
  v_existing_request_fingerprint text;
  v_gross_total bigint;
  v_item record;
  v_item_count integer;
  v_joined_item_count integer := 0;
  v_payment_count integer;
  v_subtotal_in_cents integer := 0;
  v_total_in_cents integer;
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

  if p_payments is null
    or jsonb_typeof(p_payments) <> 'array'
    or jsonb_array_length(p_payments) not between 1 and 2
  then
    raise exception 'Sale must have one or two payment methods.';
  end if;

  if p_discount_in_cents is null or p_discount_in_cents < 0 then
    raise exception 'Sale discount must be a non-negative integer.';
  end if;

  if p_request_fingerprint is null or trim(p_request_fingerprint) = '' then
    raise exception 'Sale request fingerprint is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('sale:' || p_sale_id::text, 0)
  );

  select operator_id, request_fingerprint
  into v_existing_operator_id, v_existing_request_fingerprint
  from public.sales
  where id = p_sale_id;

  if found then
    if v_existing_operator_id = v_user_id
      and v_existing_request_fingerprint = p_request_fingerprint
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
    for update of products
  loop
    v_joined_item_count := v_joined_item_count + 1;

    perform pg_advisory_xact_lock(hashtextextended(v_item.product_id::text, 0));

    select coalesce(sum(quantity_change), 0)
    into v_balance
    from public.stock_movements
    where product_id = v_item.product_id;

    if v_balance < v_item.quantity then
      raise exception 'Insufficient stock for product %.', v_item.product_name;
    end if;

    v_subtotal_in_cents :=
      v_subtotal_in_cents + (v_item.quantity * v_item.price_in_cents);
  end loop;

  if v_item_count <> v_joined_item_count then
    raise exception 'Product unavailable for sale.';
  end if;

  if v_subtotal_in_cents <= 0 then
    raise exception 'Sale subtotal must be greater than zero.';
  end if;

  if p_discount_in_cents >= v_subtotal_in_cents then
    raise exception 'Sale discount must be lower than the subtotal.';
  end if;

  v_total_in_cents := v_subtotal_in_cents - p_discount_in_cents;

  if exists (
    select 1
    from jsonb_to_recordset(p_payments) as payment(
      method text,
      amount_in_cents integer,
      installment_count integer
    )
    where payment.method is null
      or payment.method not in ('cash', 'pix', 'credit_card', 'debit_card')
      or payment.amount_in_cents is null
      or payment.amount_in_cents <= 0
      or (
        payment.method = 'credit_card'
        and (
          payment.installment_count is null
          or payment.installment_count not between 1 and 3
        )
      )
      or (
        payment.method <> 'credit_card'
        and payment.installment_count is not null
      )
  ) then
    raise exception 'Sale payments are invalid.';
  end if;

  select count(*), sum(payment.amount_in_cents)::bigint
  into v_payment_count, v_gross_total
  from jsonb_to_recordset(p_payments) as payment(
    method text,
    amount_in_cents integer,
    installment_count integer
  );

  if v_payment_count <> (
    select count(distinct payment.method)
    from jsonb_to_recordset(p_payments) as payment(
      method text,
      amount_in_cents integer,
      installment_count integer
    )
  ) then
    raise exception 'A payment method cannot be repeated.';
  end if;

  if v_gross_total < v_total_in_cents then
    raise exception 'Payment amounts do not cover the sale total.';
  end if;

  if v_gross_total > 2147483647 then
    raise exception 'Payment total is outside the supported range.';
  end if;

  select payment.amount_in_cents
  into v_cash_amount_in_cents
  from jsonb_to_recordset(p_payments) as payment(
    method text,
    amount_in_cents integer,
    installment_count integer
  )
  where payment.method = 'cash';

  if v_gross_total > v_total_in_cents then
    if v_cash_amount_in_cents is null then
      raise exception 'Only cash payments can exceed the sale total.';
    end if;

    v_change_in_cents := (v_gross_total - v_total_in_cents)::integer;
    if v_cash_amount_in_cents - v_change_in_cents < 1 then
      raise exception 'Every payment must contribute at least one cent.';
    end if;
  end if;

  insert into public.sales (
    id,
    cash_session_id,
    operator_id,
    status,
    subtotal_in_cents,
    discount_in_cents,
    total_in_cents,
    completed_at,
    request_fingerprint
  )
  values (
    p_sale_id,
    v_cash_session.id,
    v_user_id,
    'completed',
    v_subtotal_in_cents,
    p_discount_in_cents,
    v_total_in_cents,
    v_completed_at,
    p_request_fingerprint
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
    change_in_cents,
    installment_count
  )
  select
    p_sale_id,
    payment.method::public.payment_method,
    payment.amount_in_cents,
    case when payment.method = 'cash' then v_change_in_cents else 0 end,
    payment.installment_count::smallint
  from jsonb_to_recordset(p_payments) as payment(
    method text,
    amount_in_cents integer,
    installment_count integer
  )
  order by payment.method;

  return p_sale_id;
end;
$$;

create or replace function public.finalize_sale_transaction(
  p_sale_id uuid,
  p_cash_session_id uuid,
  p_items jsonb,
  p_payment jsonb,
  p_discount_in_cents integer,
  p_request_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_amount_in_cents integer;
  v_change_in_cents integer;
  v_payment_method text;
  v_persisted_change_in_cents integer;
  v_sale_id uuid;
begin
  if p_payment is null or jsonb_typeof(p_payment) <> 'object' then
    raise exception 'Sale payment is required.';
  end if;

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

  if v_payment_method <> 'cash' and v_change_in_cents <> 0 then
    raise exception 'Non-cash payments cannot register change.';
  end if;

  begin
    v_sale_id := public.finalize_sale_payments_transaction(
      p_sale_id,
      p_cash_session_id,
      p_items,
      jsonb_build_array(
        jsonb_strip_nulls(
          jsonb_build_object(
            'method', v_payment_method,
            'amount_in_cents', v_amount_in_cents,
            'installment_count',
              case when v_payment_method = 'credit_card' then 1 else null end
          )
        )
      ),
      p_discount_in_cents,
      p_request_fingerprint
    );
  exception
    when others then
      if sqlerrm in (
        'Sale payments are invalid.',
        'Payment amounts do not cover the sale total.',
        'Only cash payments can exceed the sale total.',
        'Every payment must contribute at least one cent.'
      ) then
        if v_payment_method = 'cash' then
          raise exception 'Payment amount and change do not match sale total.';
        end if;

        raise exception 'Non-cash payments must match the sale total.';
      end if;

      raise;
  end;

  select change_in_cents
  into v_persisted_change_in_cents
  from public.payments
  where sale_id = v_sale_id
    and method = v_payment_method::public.payment_method;

  if v_persisted_change_in_cents <> v_change_in_cents then
    raise exception 'Payment amount and change do not match sale total.';
  end if;

  return v_sale_id;
end;
$$;

create or replace function public.finalize_sale_v5(
  p_sale_id uuid,
  p_cash_session_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_discount_in_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_canonical_payments jsonb;
  v_request_fingerprint text;
begin
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'Sale payments are required.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'method', payment.method,
          'amount_in_cents', payment.amount_in_cents,
          'installment_count', payment.installment_count
        )
      )
      order by payment.method
    ),
    '[]'::jsonb
  )
  into v_canonical_payments
  from jsonb_to_recordset(p_payments) as payment(
    method text,
    amount_in_cents integer,
    installment_count integer
  );

  v_request_fingerprint := encode(
    extensions.digest(
      'v5|'
        || p_cash_session_id::text
        || '|' || p_items::text
        || '|' || v_canonical_payments::text
        || '|' || p_discount_in_cents::text,
      'sha256'
    ),
    'hex'
  );

  return public.finalize_sale_payments_transaction(
    p_sale_id,
    p_cash_session_id,
    p_items,
    v_canonical_payments,
    p_discount_in_cents,
    v_request_fingerprint
  );
end;
$$;

revoke all on function public.finalize_sale_payments_transaction(
  uuid, uuid, jsonb, jsonb, integer, text
) from public;
revoke execute on function public.finalize_sale_payments_transaction(
  uuid, uuid, jsonb, jsonb, integer, text
) from anon, authenticated;

revoke all on function public.finalize_sale_transaction(
  uuid, uuid, jsonb, jsonb, integer, text
) from public;
revoke execute on function public.finalize_sale_transaction(
  uuid, uuid, jsonb, jsonb, integer, text
) from anon, authenticated;

revoke all on function public.finalize_sale_v5(
  uuid, uuid, jsonb, jsonb, integer
) from public;
revoke execute on function public.finalize_sale_v5(
  uuid, uuid, jsonb, jsonb, integer
) from anon;
grant execute on function public.finalize_sale_v5(
  uuid, uuid, jsonb, jsonb, integer
) to authenticated;

notify pgrst, 'reload schema';
commit;
