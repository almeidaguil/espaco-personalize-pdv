begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(28);

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

select * from extensions.finish();
rollback;
