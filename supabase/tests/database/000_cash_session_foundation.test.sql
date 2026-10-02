begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(54);

select extensions.has_column(
  'public',
  'cash_sessions',
  'business_date',
  'cash_sessions has a business_date column'
);

select extensions.is(
  (
    select attributes.attgenerated::text
    from pg_catalog.pg_attribute as attributes
    where attributes.attrelid = 'public.cash_sessions'::regclass
      and attributes.attname = 'business_date'
  ),
  's',
  'business_date is generated and cannot be supplied by clients'
);

select extensions.ok(
  (
    select pg_get_expr(defaults.adbin, defaults.adrelid)
    from pg_catalog.pg_attrdef as defaults
    join pg_catalog.pg_attribute as attributes
      on attributes.attrelid = defaults.adrelid
     and attributes.attnum = defaults.adnum
    where defaults.adrelid = 'public.cash_sessions'::regclass
      and attributes.attname = 'business_date'
  ) like '%America/Sao_Paulo%',
  'business_date is generated in the Sao Paulo timezone'
);

select extensions.is(
  (
    select attributes.attnotnull
    from pg_catalog.pg_attribute as attributes
    where attributes.attrelid = 'public.cash_sessions'::regclass
      and attributes.attname = 'business_date'
  ),
  true,
  'business_date is required'
);

select extensions.is(
  (
    select attributes.attnotnull
    from pg_catalog.pg_attribute as attributes
    where attributes.attrelid = 'public.cash_sessions'::regclass
      and attributes.attname = 'event_id'
  ),
  false,
  'cash_sessions.event_id is nullable during the transition'
);

select extensions.is(
  (
    select attributes.attnotnull
    from pg_catalog.pg_attribute as attributes
    where attributes.attrelid = 'public.sales'::regclass
      and attributes.attname = 'event_id'
  ),
  false,
  'sales.event_id is nullable during the transition'
);

select extensions.has_column(
  'public',
  'sales',
  'request_fingerprint',
  'sales stores the idempotency request fingerprint'
);

select extensions.is(
  (
    select tables.relrowsecurity
    from pg_catalog.pg_class as tables
    where tables.oid = 'public.cash_sessions'::regclass
  ),
  true,
  'cash_sessions keeps RLS enabled'
);

select extensions.is(
  (
    select tables.relrowsecurity
    from pg_catalog.pg_class as tables
    where tables.oid = 'public.sales'::regclass
  ),
  true,
  'sales keeps RLS enabled'
);

select extensions.ok(
  to_regclass('public.cash_sessions_one_open_per_operator_idx') is not null,
  'the global open-session index exists'
);

select extensions.is(
  (
    select indexes.indisunique
    from pg_catalog.pg_index as indexes
    where indexes.indexrelid =
      'public.cash_sessions_one_open_per_operator_idx'::regclass
  ),
  true,
  'the global open-session index is unique'
);

select extensions.ok(
  (
    select pg_get_expr(indexes.indpred, indexes.indrelid)
    from pg_catalog.pg_index as indexes
    where indexes.indexrelid =
      'public.cash_sessions_one_open_per_operator_idx'::regclass
  ) like '%status%open%',
  'the global index applies only to open sessions'
);

select extensions.ok(
  to_regclass('public.cash_sessions_business_date_operator_idx') is not null,
  'the business-date and operator index exists'
);

select extensions.ok(
  to_regclass(
    'public.cash_sessions_operator_business_date_opened_at_idx'
  ) is not null,
  'the operator-first business-date index exists'
);

select extensions.ok(
  to_regclass('public.cash_sessions_status_opened_at_idx') is not null,
  'the cash-session status and date index exists'
);

select extensions.ok(
  to_regclass('public.sales_completed_at_idx') is not null,
  'the sales date index exists'
);

select extensions.ok(
  to_regclass('public.sales_operator_completed_at_idx') is not null,
  'the sales operator and date index exists'
);

select extensions.ok(
  to_regclass('public.sales_cash_session_completed_at_idx') is not null,
  'the sales cash-session and date index exists'
);

select extensions.ok(
  to_regprocedure('public.open_cash_session_v2(integer,uuid)') is not null,
  'the event-optional cash opening RPC exists'
);

select extensions.ok(
  to_regprocedure('public.finalize_sale_v2(uuid,jsonb,jsonb)') is not null,
  'the event-free sale RPC exists'
);

select extensions.ok(
  to_regprocedure(
    'public.finalize_sale(uuid,uuid,uuid,timestamp with time zone,jsonb,jsonb,integer)'
  ) is not null,
  'the legacy finalize_sale RPC remains available'
);

select extensions.ok(
  to_regprocedure(
    'public.close_cash_session(uuid,integer,timestamp with time zone,text)'
  ) is not null,
  'the legacy close_cash_session RPC remains available'
);

select extensions.is(
  (
    select procedures.prosecdef
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.open_cash_session_v2(integer,uuid)'::regprocedure
  ),
  true,
  'open_cash_session_v2 is security definer'
);

select extensions.is(
  (
    select procedures.prosecdef
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.finalize_sale_v2(uuid,jsonb,jsonb)'::regprocedure
  ),
  true,
  'finalize_sale_v2 is security definer'
);

select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.open_cash_session_v2(integer,uuid)'::regprocedure
  ),
  'search_path=pg_catalog, public, pg_temp',
  'open_cash_session_v2 has a controlled search_path'
);

select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.finalize_sale_v2(uuid,jsonb,jsonb)'::regprocedure
  ),
  'search_path=pg_catalog, public, pg_temp',
  'finalize_sale_v2 has a controlled search_path'
);

select extensions.ok(
  pg_get_function_arguments(
    'public.open_cash_session_v2(integer,uuid)'::regprocedure
  ) not like '%operator%',
  'the opening RPC does not accept an operator identity'
);

select extensions.is(
  pg_get_function_arguments(
    'public.finalize_sale_v2(uuid,jsonb,jsonb)'::regprocedure
  ),
  'p_sale_id uuid, p_items jsonb, p_payment jsonb',
  'the sale RPC accepts only an idempotency id and sale contents'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.open_cash_session_v2(integer,uuid)',
    'EXECUTE'
  ),
  'authenticated users can execute the opening RPC'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.open_cash_session_v2(integer,uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the opening RPC'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.finalize_sale_v2(uuid,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated users can execute the sale RPC'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.finalize_sale_v2(uuid,jsonb,jsonb)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the sale RPC'
);

select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.cash_sessions',
    'UPDATE'
  ),
  'authenticated users cannot update cash sessions directly'
);

select extensions.ok(
  has_table_privilege(
    'authenticated',
    'public.cash_sessions',
    'INSERT'
  ),
  'legacy authenticated inserts remain temporarily available'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.sales', 'INSERT'),
  'authenticated users cannot insert sales directly'
);

select extensions.ok(
  not has_schema_privilege('authenticated', 'public', 'CREATE'),
  'authenticated users cannot create objects in the public schema'
);

select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.finalize_sale(uuid,uuid,uuid,timestamp with time zone,jsonb,jsonb,integer)'::regprocedure
  ),
  'search_path=pg_catalog, public, pg_temp',
  'legacy finalize_sale has a controlled search_path'
);

select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.cancel_sale(uuid,timestamp with time zone,text)'::regprocedure
  ),
  'search_path=pg_catalog, public, pg_temp',
  'legacy cancel_sale has a controlled search_path'
);

select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.close_cash_session(uuid,integer,timestamp with time zone,text)'::regprocedure
  ),
  'search_path=pg_catalog, public, pg_temp',
  'legacy close_cash_session has a controlled search_path'
);

select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid = 'public.verify_admin_password(text)'::regprocedure
  ),
  'search_path=pg_catalog, public, auth, extensions, pg_temp',
  'verify_admin_password has a controlled search_path'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.finalize_sale(uuid,uuid,uuid,timestamp with time zone,jsonb,jsonb,integer)',
    'EXECUTE'
  ),
  'authenticated users keep legacy finalize_sale access'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.finalize_sale(uuid,uuid,uuid,timestamp with time zone,jsonb,jsonb,integer)',
    'EXECUTE'
  ),
  'anonymous users cannot execute legacy finalize_sale'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.cancel_sale(uuid,timestamp with time zone,text)',
    'EXECUTE'
  ),
  'authenticated users keep cancel_sale access'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.cancel_sale(uuid,timestamp with time zone,text)',
    'EXECUTE'
  ),
  'anonymous users cannot execute cancel_sale'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.close_cash_session(uuid,integer,timestamp with time zone,text)',
    'EXECUTE'
  ),
  'authenticated users keep close_cash_session access'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.close_cash_session(uuid,integer,timestamp with time zone,text)',
    'EXECUTE'
  ),
  'anonymous users cannot execute close_cash_session'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.verify_admin_password(text)',
    'EXECUTE'
  ),
  'authenticated users cannot execute verify_admin_password directly'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.verify_admin_password(text)',
    'EXECUTE'
  ),
  'anonymous users cannot execute verify_admin_password'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'cash_sessions'
      and policyname = 'Users can read allowed cash sessions'
  ),
  'cash session reads use the operator/admin policy'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'sales'
      and policyname = 'Users can read allowed sales'
  ),
  'sale reads use the operator/admin policy'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'sale_items'
      and policyname = 'Users can read items from allowed sales'
  ),
  'sale item reads follow the parent sale policy'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'Users can read payments from allowed sales'
  ),
  'payment reads follow the parent sale policy'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.cash_sessions'::regclass
      and tgname = 'cash_sessions_prepare_legacy_insert'
      and not tgisinternal
  ),
  'legacy inserts are hardened by a server-side trigger'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.sales'::regclass
      and tgname = 'sales_prepare_insert'
      and not tgisinternal
  ),
  'legacy sale inserts are hardened by a server-side trigger'
);

select * from extensions.finish();

rollback;
