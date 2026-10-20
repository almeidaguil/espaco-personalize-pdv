begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(51);

select extensions.has_column(
  'public', 'payments', 'installment_count',
  'payments stores the credit installment count'
);
select extensions.col_type_is(
  'public', 'payments', 'installment_count', 'smallint',
  'installment count uses a bounded integer type'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_sale_method_unique'
      and contype = 'u'
  ),
  'a sale cannot repeat a payment method'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_amount_positive_v2'
      and contype = 'c'
  ),
  'every payment has a positive gross amount'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_change_only_cash'
      and contype = 'c'
  ),
  'only cash can register change'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_net_amount_positive'
      and contype = 'c'
  ),
  'every payment contributes at least one cent'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_installment_matches_method'
      and contype = 'c'
  ),
  'installments are required only for credit'
);

select extensions.has_table(
  'public', 'cash_session_reconciliations',
  'cash session reconciliation table exists'
);
select extensions.has_column(
  'public', 'cash_session_reconciliations', 'cash_session_id',
  'reconciliation identifies the cash session'
);
select extensions.has_column(
  'public', 'cash_session_reconciliations', 'method',
  'reconciliation identifies the payment method'
);
select extensions.has_column(
  'public', 'cash_session_reconciliations', 'expected_amount_in_cents',
  'reconciliation stores the server expected amount'
);
select extensions.has_column(
  'public', 'cash_session_reconciliations', 'counted_amount_in_cents',
  'reconciliation stores the operator counted amount'
);
select extensions.has_column(
  'public', 'cash_session_reconciliations', 'difference_amount_in_cents',
  'reconciliation stores the exact difference'
);
select extensions.has_column(
  'public', 'cash_session_reconciliations', 'created_at',
  'reconciliation stores its server timestamp'
);
select extensions.col_not_null(
  'public', 'cash_session_reconciliations', 'cash_session_id',
  'cash session is required'
);
select extensions.col_not_null(
  'public', 'cash_session_reconciliations', 'method',
  'payment method is required'
);
select extensions.col_not_null(
  'public', 'cash_session_reconciliations', 'expected_amount_in_cents',
  'expected amount is required'
);
select extensions.col_not_null(
  'public', 'cash_session_reconciliations', 'counted_amount_in_cents',
  'counted amount is required'
);
select extensions.col_not_null(
  'public', 'cash_session_reconciliations', 'difference_amount_in_cents',
  'difference is required'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.cash_session_reconciliations'::regclass
      and conname = 'cash_session_reconciliations_pkey'
      and contype = 'p'
  ),
  'cash session and method form the primary key'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.cash_session_reconciliations'::regclass
      and conname = 'cash_session_reconciliations_cash_session_id_fkey'
      and contype = 'f'
  ),
  'reconciliation references its cash session'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.cash_session_reconciliations'::regclass
      and conname = 'cash_session_reconciliations_expected_nonnegative'
  ),
  'expected amount cannot be negative'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.cash_session_reconciliations'::regclass
      and conname = 'cash_session_reconciliations_counted_nonnegative'
  ),
  'counted amount cannot be negative'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.cash_session_reconciliations'::regclass
      and conname = 'cash_session_reconciliations_difference_matches'
  ),
  'difference must equal counted minus expected'
);
select extensions.is(
  (
    select tables.relrowsecurity
    from pg_catalog.pg_class as tables
    where tables.oid = 'public.cash_session_reconciliations'::regclass
  ),
  true,
  'reconciliations have RLS enabled'
);
select extensions.ok(
  has_table_privilege('authenticated', 'public.cash_session_reconciliations', 'SELECT'),
  'authenticated users can read allowed reconciliations'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.cash_session_reconciliations', 'INSERT')
  and not has_table_privilege('authenticated', 'public.cash_session_reconciliations', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.cash_session_reconciliations', 'DELETE'),
  'authenticated users cannot write reconciliations directly'
);
select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'cash_session_reconciliations'
      and policyname = 'Active users can read allowed cash reconciliations'
  ),
  'reconciliation reads use the operator and admin policy'
);
select extensions.ok(
  (
    select qual::text like '%( SELECT current_user_is_active() AS current_user_is_active)%'
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'cash_session_reconciliations'
      and policyname = 'Active users can read allowed cash reconciliations'
  ),
  'reconciliation policy caches the active-user authorization helper'
);

select extensions.ok(
  to_regprocedure(
    'public.finalize_sale_v5(uuid,uuid,jsonb,jsonb,integer)'
  ) is not null,
  'the split payment sale RPC exists'
);
select extensions.is(
  pg_get_function_result(
    'public.finalize_sale_v5(uuid,uuid,jsonb,jsonb,integer)'::regprocedure
  ),
  'uuid',
  'the split payment sale RPC returns the sale identifier'
);
select extensions.is(
  pg_get_function_arguments(
    'public.finalize_sale_v5(uuid,uuid,jsonb,jsonb,integer)'::regprocedure
  ),
  'p_sale_id uuid, p_cash_session_id uuid, p_items jsonb, p_payments jsonb, p_discount_in_cents integer',
  'the split payment RPC accepts only trusted sale intent'
);
select extensions.is(
  (
    select procedures.prosecdef
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.finalize_sale_v5(uuid,uuid,jsonb,jsonb,integer)'::regprocedure
  ),
  true,
  'finalize_sale_v5 is security definer'
);
select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.finalize_sale_v5(uuid,uuid,jsonb,jsonb,integer)'::regprocedure
  ),
  'search_path=pg_catalog, public, pg_temp',
  'finalize_sale_v5 has a controlled search_path'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.finalize_sale_v5(uuid,uuid,jsonb,jsonb,integer)',
    'EXECUTE'
  ),
  'authenticated users can finalize split payment sales'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.finalize_sale_v5(uuid,uuid,jsonb,jsonb,integer)',
    'EXECUTE'
  ),
  'anonymous users cannot finalize split payment sales'
);
select extensions.ok(
  to_regprocedure(
    'public.finalize_sale_payments_transaction(uuid,uuid,jsonb,jsonb,integer,text)'
  ) is not null,
  'the split payment transaction helper exists'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.finalize_sale_payments_transaction(uuid,uuid,jsonb,jsonb,integer,text)',
    'EXECUTE'
  ),
  'authenticated users cannot execute the split payment helper directly'
);
select extensions.ok(
  not has_function_privilege(
    'public',
    'public.finalize_sale_payments_transaction(uuid,uuid,jsonb,jsonb,integer,text)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute the split payment helper directly'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.finalize_sale_v3(uuid,uuid,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated users retain V3 compatibility'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.finalize_sale_v4(uuid,uuid,jsonb,jsonb,integer)',
    'EXECUTE'
  ),
  'authenticated users retain V4 compatibility'
);

select extensions.ok(
  to_regprocedure('public.close_cash_session_v2(uuid,jsonb,text)') is not null,
  'the payment reconciliation close RPC exists'
);
select extensions.is(
  pg_get_function_result(
    'public.close_cash_session_v2(uuid,jsonb,text)'::regprocedure
  ),
  'uuid',
  'the payment reconciliation close RPC returns the cash session identifier'
);
select extensions.is(
  pg_get_function_arguments(
    'public.close_cash_session_v2(uuid,jsonb,text)'::regprocedure
  ),
  'p_cash_session_id uuid, p_reconciliations jsonb, p_admin_password text DEFAULT NULL::text',
  'the close RPC accepts only counted values and optional admin password'
);
select extensions.is(
  (
    select procedures.prosecdef
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.close_cash_session_v2(uuid,jsonb,text)'::regprocedure
  ),
  true,
  'close_cash_session_v2 is security definer'
);
select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.close_cash_session_v2(uuid,jsonb,text)'::regprocedure
  ),
  'search_path=pg_catalog, public, pg_temp',
  'close_cash_session_v2 has a controlled search_path'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.close_cash_session_v2(uuid,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated users can close with payment reconciliation'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.close_cash_session_v2(uuid,jsonb,text)',
    'EXECUTE'
  ),
  'anonymous users cannot close with payment reconciliation'
);
select extensions.ok(
  not has_function_privilege(
    'public',
    'public.close_cash_session_v2(uuid,jsonb,text)',
    'EXECUTE'
  ),
  'PUBLIC cannot close with payment reconciliation'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.close_cash_session(uuid,integer,timestamp with time zone,text)',
    'EXECUTE'
  ),
  'authenticated users cannot bypass payment reconciliation through the legacy close RPC'
);
select extensions.ok(
  pg_get_functiondef(
    'public.close_cash_session_v2(uuid,jsonb,text)'::regprocedure
  ) ilike '%clock_timestamp()%'
  and pg_get_functiondef(
    'public.close_cash_session_v2(uuid,jsonb,text)'::regprocedure
  ) ilike '%for update%',
  'the close RPC uses the server clock and locks the cash session'
);

select * from extensions.finish();
rollback;
