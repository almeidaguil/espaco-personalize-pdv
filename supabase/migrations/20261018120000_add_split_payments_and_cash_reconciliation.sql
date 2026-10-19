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

  if exists (
    select 1
    from public.sales
    left join public.payments on payments.sale_id = sales.id
    group by sales.id
    having count(payments.id) = 0
  ) then
    raise exception using
      message = 'Split payment migration found a sale without payments.',
      hint = 'Restore the audited payment for every historical sale before retrying.';
  end if;

  if exists (
    select 1
    from public.payments
    group by sale_id
    having count(distinct method) > 2
  ) then
    raise exception using
      message = 'Split payment migration found a sale with more than two payment methods.',
      hint = 'Consolidate historical payments to at most two audited methods before retrying.';
  end if;

  if exists (
    select 1
    from public.sales
    join public.payments on payments.sale_id = sales.id
    group by sales.id, sales.total_in_cents
    having sum(payments.amount_in_cents - payments.change_in_cents)
      <> sales.total_in_cents
  ) then
    raise exception using
      message = 'Split payment migration found a sale whose payments do not match its total.',
      hint = 'Reconcile every historical payment total with its audited sale before retrying.';
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
      and installment_count is not null
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
    (select public.current_user_is_active())
    and exists (
      select 1
      from public.cash_sessions
      where cash_sessions.id = cash_session_reconciliations.cash_session_id
        and (
          cash_sessions.operator_id = (select auth.uid())
          or (select public.current_user_is_admin())
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

create or replace function public.close_cash_session_v2(
  p_cash_session_id uuid,
  p_reconciliations jsonb,
  p_admin_password text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_cash_counted integer;
  v_cash_expected bigint;
  v_cash_session record;
  v_closed_at timestamptz;
  v_credit_expected bigint;
  v_debit_expected bigint;
  v_expected bigint;
  v_has_difference boolean := false;
  v_pix_expected bigint;
  v_reconciliation record;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required to close a cash session.';
  end if;

  if not public.current_user_is_active() then
    raise exception 'An active user is required to close a cash session.';
  end if;

  if p_cash_session_id is null then
    raise exception 'Cash session is required.';
  end if;

  if p_reconciliations is null
    or jsonb_typeof(p_reconciliations) <> 'array'
    or jsonb_array_length(p_reconciliations) <> 4
  then
    raise exception 'All payment methods must be reconciled exactly once.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_reconciliations) as reconciliation(
      method text,
      counted_amount_in_cents integer
    )
    where reconciliation.method is null
      or reconciliation.method not in (
        'cash', 'pix', 'credit_card', 'debit_card'
      )
      or reconciliation.counted_amount_in_cents is null
      or reconciliation.counted_amount_in_cents < 0
  ) or (
    select count(distinct reconciliation.method)
    from jsonb_to_recordset(p_reconciliations) as reconciliation(
      method text,
      counted_amount_in_cents integer
    )
  ) <> 4 then
    raise exception 'All payment methods must be reconciled exactly once.';
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

  if v_cash_session.operator_id <> v_user_id
    and not public.current_user_is_admin()
  then
    raise exception 'User is not allowed to close this cash session.';
  end if;

  select
    v_cash_session.opening_amount_in_cents + coalesce(sum(
      payments.amount_in_cents - payments.change_in_cents
    ) filter (where payments.method = 'cash'), 0),
    coalesce(sum(
      payments.amount_in_cents - payments.change_in_cents
    ) filter (where payments.method = 'pix'), 0),
    coalesce(sum(
      payments.amount_in_cents - payments.change_in_cents
    ) filter (where payments.method = 'credit_card'), 0),
    coalesce(sum(
      payments.amount_in_cents - payments.change_in_cents
    ) filter (where payments.method = 'debit_card'), 0)
  into
    v_cash_expected,
    v_pix_expected,
    v_credit_expected,
    v_debit_expected
  from public.sales
  left join public.payments
    on payments.sale_id = sales.id
  where sales.cash_session_id = p_cash_session_id
    and sales.status = 'completed';

  if greatest(
    v_cash_expected,
    v_pix_expected,
    v_credit_expected,
    v_debit_expected
  ) > 2147483647 then
    raise exception 'Expected amount is outside the supported range.';
  end if;

  for v_reconciliation in
    select reconciliation.method, reconciliation.counted_amount_in_cents
    from jsonb_to_recordset(p_reconciliations) as reconciliation(
      method text,
      counted_amount_in_cents integer
    )
  loop
    v_expected := case v_reconciliation.method
      when 'cash' then v_cash_expected
      when 'pix' then v_pix_expected
      when 'credit_card' then v_credit_expected
      when 'debit_card' then v_debit_expected
    end;

    if v_reconciliation.counted_amount_in_cents <> v_expected then
      v_has_difference := true;
    end if;
  end loop;

  if v_has_difference and not public.verify_admin_password(p_admin_password) then
    raise exception 'Admin password is required to close a cash session with differences.';
  end if;

  v_closed_at := clock_timestamp();
  if v_closed_at <= v_cash_session.opened_at then
    raise exception 'Cash session close date must be after open date.';
  end if;

  for v_reconciliation in
    select reconciliation.method, reconciliation.counted_amount_in_cents
    from jsonb_to_recordset(p_reconciliations) as reconciliation(
      method text,
      counted_amount_in_cents integer
    )
    order by reconciliation.method
  loop
    v_expected := case v_reconciliation.method
      when 'cash' then v_cash_expected
      when 'pix' then v_pix_expected
      when 'credit_card' then v_credit_expected
      when 'debit_card' then v_debit_expected
    end;

    insert into public.cash_session_reconciliations (
      cash_session_id,
      method,
      expected_amount_in_cents,
      counted_amount_in_cents,
      difference_amount_in_cents,
      created_at
    )
    values (
      p_cash_session_id,
      v_reconciliation.method::public.payment_method,
      v_expected::integer,
      v_reconciliation.counted_amount_in_cents,
      v_reconciliation.counted_amount_in_cents - v_expected::integer,
      v_closed_at
    );

    if v_reconciliation.method = 'cash' then
      v_cash_counted := v_reconciliation.counted_amount_in_cents;
    end if;
  end loop;

  update public.cash_sessions
  set
    closed_at = v_closed_at,
    closed_by = v_user_id,
    counted_amount_in_cents = v_cash_counted,
    difference_amount_in_cents = v_cash_counted - v_cash_expected::integer,
    expected_amount_in_cents = v_cash_expected::integer,
    status = 'closed'
  where id = p_cash_session_id
    and status = 'open';

  if not found then
    raise exception 'Cash session is already closed.';
  end if;

  return p_cash_session_id;
end;
$$;

revoke all on function public.close_cash_session_v2(uuid, jsonb, text)
  from public;
revoke execute on function public.close_cash_session_v2(uuid, jsonb, text)
  from anon;
grant execute on function public.close_cash_session_v2(uuid, jsonb, text)
  to authenticated;

do $report_migration$
declare
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(
    'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)'::regprocedure
  )
  into v_definition;

  v_updated_definition := replace(
    v_definition,
    $old_reconciliation_totals$    'items_limit', p_items_limit,$old_reconciliation_totals$,
    $new_reconciliation_totals$    'reconciliation_difference_total_in_cents', coalesce((
      select sum(reconciliations.difference_amount_in_cents)
      from public.cash_session_reconciliations as reconciliations
      join filtered_sessions
        on filtered_sessions.id = reconciliations.cash_session_id
      where filtered_sessions.status = 'closed'
    ), 0),
    'reconciliation_shortage_total_in_cents', coalesce((
      select sum(greatest(-reconciliations.difference_amount_in_cents, 0))
      from public.cash_session_reconciliations as reconciliations
      join filtered_sessions
        on filtered_sessions.id = reconciliations.cash_session_id
      where filtered_sessions.status = 'closed'
    ), 0),
    'reconciliation_surplus_total_in_cents', coalesce((
      select sum(greatest(reconciliations.difference_amount_in_cents, 0))
      from public.cash_session_reconciliations as reconciliations
      join filtered_sessions
        on filtered_sessions.id = reconciliations.cash_session_id
      where filtered_sessions.status = 'closed'
    ), 0),
    'items_limit', p_items_limit,$new_reconciliation_totals$
  );

  if v_updated_definition = v_definition then
    raise exception 'Could not extend sale report reconciliation totals.';
  end if;

  v_definition := v_updated_definition;
  v_updated_definition := replace(
    v_definition,
    $old_adjustment_summary$    'post_close_adjustment_payment_summary', coalesce(($old_adjustment_summary$,
    $new_adjustment_summary$    'credit_installment_summary', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'installment_count', installment_totals.installment_count,
          'sales_count', installment_totals.sales_count,
          'net_total_in_cents', installment_totals.net_total_in_cents
        )
        order by installment_totals.installment_count
      )
      from (
        select
          installments.installment_count,
          count(distinct payments.sale_id)::integer as sales_count,
          coalesce(
            sum(payments.amount_in_cents - payments.change_in_cents),
            0
          )::bigint as net_total_in_cents
        from (values (1::smallint), (2::smallint), (3::smallint))
          as installments(installment_count)
        left join public.payments
          on payments.method = 'credit_card'
         and payments.installment_count = installments.installment_count
         and exists (
           select 1
           from recognized_sales
           where recognized_sales.id = payments.sale_id
         )
        group by installments.installment_count
      ) as installment_totals
    ), '[]'::jsonb),
    'post_close_adjustment_payment_summary', coalesce(($new_adjustment_summary$
  );

  if v_updated_definition = v_definition then
    raise exception 'Could not extend sale report installment summary.';
  end if;

  v_definition := v_updated_definition;
  v_updated_definition := replace(
    v_definition,
    $old_session_reconciliation$          'difference_amount_in_cents', session_totals.difference_amount_in_cents,
          'completed_sales_count', session_totals.completed_sales_count,$old_session_reconciliation$,
    $new_session_reconciliation$          'difference_amount_in_cents', session_totals.difference_amount_in_cents,
          'reconciliations', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'method', reconciliations.method,
                'expected_amount_in_cents', reconciliations.expected_amount_in_cents,
                'counted_amount_in_cents', reconciliations.counted_amount_in_cents,
                'difference_amount_in_cents', reconciliations.difference_amount_in_cents
              )
              order by reconciliations.method
            )
            from public.cash_session_reconciliations as reconciliations
            where reconciliations.cash_session_id = session_totals.id
          ), '[]'::jsonb),
          'completed_sales_count', session_totals.completed_sales_count,$new_session_reconciliation$
  );

  if v_updated_definition = v_definition then
    raise exception 'Could not extend sale report session reconciliations.';
  end if;

  execute v_updated_definition;
end;
$report_migration$;

notify pgrst, 'reload schema';
commit;
