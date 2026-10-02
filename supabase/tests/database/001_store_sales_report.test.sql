begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(28);

select extensions.ok(
  to_regclass('public.sales_cash_session_status_idx') is not null,
  'the report sales index exists'
);

select extensions.ok(
  to_regclass('public.cash_sessions_report_period_idx') is not null,
  'the report period index exists'
);

select extensions.has_column(
  'public',
  'sales',
  'canceled_business_date',
  'sales has a cancellation business date'
);

select extensions.ok(
  to_regclass('public.sales_canceled_business_date_operator_idx') is not null,
  'the post-close adjustment index exists'
);

select extensions.ok(
  to_regprocedure('public.current_user_is_active()') is not null,
  'the active-user helper exists'
);

select extensions.ok(
  to_regprocedure('public.current_user_is_admin()') is not null,
  'the admin helper exists'
);

select extensions.ok(
  to_regprocedure(
    'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)'
  ) is not null,
  'the store sales report RPC exists'
);

select extensions.is(
  (
    select procedures.prosecdef
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)'::regprocedure
  ),
  false,
  'the report RPC is security invoker'
);

select extensions.is(
  (
    select procedures.provolatile::text
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)'::regprocedure
  ),
  's',
  'the report RPC is stable'
);

select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)'::regprocedure
  ),
  'search_path=pg_catalog, public, pg_temp',
  'the report RPC has a controlled search_path'
);

select extensions.is(
  pg_get_function_arguments(
    'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)'::regprocedure
  ),
  'p_start_date date, p_end_date date, p_operator_id uuid DEFAULT NULL::uuid, p_cash_session_id uuid DEFAULT NULL::uuid, p_items_limit integer DEFAULT 50, p_items_offset integer DEFAULT 0, p_sessions_limit integer DEFAULT 50, p_sessions_offset integer DEFAULT 0, p_export_mode boolean DEFAULT false',
  'the report RPC accepts report filters and bounded pagination'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)',
    'EXECUTE'
  ),
  'authenticated users can execute the report RPC'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the report RPC'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.current_user_is_active()',
    'EXECUTE'
  ),
  'authenticated users can execute the active-user helper'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.current_user_is_active()',
    'EXECUTE'
  ),
  'anonymous users cannot execute the active-user helper'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.current_user_is_admin()',
    'EXECUTE'
  ),
  'authenticated users can execute the admin helper'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.current_user_is_admin()',
    'EXECUTE'
  ),
  'anonymous users cannot execute the admin helper'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Admins can read operator profiles'
  ),
  'admins can resolve operator names through RLS'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Active users can read own profile'
      and qual like '%current_user_is_active%'
  ),
  'profile reads require an active user'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'cash_sessions'
      and policyname = 'Active users can read allowed cash sessions'
      and qual like '%current_user_is_active%'
  ),
  'cash-session reads require an active user'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'sales'
      and policyname = 'Active users can read allowed sales'
      and qual like '%current_user_is_active%'
  ),
  'sale reads require an active user'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('sale_items', 'payments')
      and policyname like 'Active users can read%'
      and qual like '%current_user_is_active%'
    group by schemaname
    having count(*) = 2
  ),
  'sale-item and payment reads require an active user'
);

select extensions.ok(
  pg_get_functiondef(
    'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)'::regprocedure
  ) like '%post_close_adjustments%',
  'the report separates post-close adjustments'
);

select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid = 'public.current_user_is_active()'::regprocedure
  ),
  'search_path=pg_catalog, public, auth, pg_temp',
  'the active-user helper has a controlled search_path'
);

select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid = 'public.current_user_is_admin()'::regprocedure
  ),
  'search_path=pg_catalog, public, auth, pg_temp',
  'the admin helper has a controlled search_path'
);

select extensions.ok(
  pg_get_functiondef(
    'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)'::regprocedure
  ) like '%current_user_is_active%',
  'the report RPC rejects inactive users'
);

select extensions.ok(
  pg_get_functiondef(
    'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)'::regprocedure
  ) like '%cash_sessions.business_date between p_start_date and p_end_date%',
  'the report period uses the cash-session business date'
);

select extensions.ok(
  pg_get_functiondef(
    'public.get_store_sales_report_v2(date,date,uuid,uuid,integer,integer,integer,integer,boolean)'::regprocedure
  ) like '%v_is_admin or cash_sessions.operator_id = v_user_id%',
  'the report RPC restricts operators to their own cash sessions'
);

select * from extensions.finish();

rollback;
