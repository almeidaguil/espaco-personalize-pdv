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

notify pgrst, 'reload schema';
commit;
