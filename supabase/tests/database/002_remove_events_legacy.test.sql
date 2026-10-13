begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(32);

-- These contracts catch an incomplete cut or weakened sale security/indexes.
select extensions.ok(to_regclass('public.events') is null,
  'legacy events table is removed');
select extensions.hasnt_column('public', 'cash_sessions', 'event_id',
  'cash sessions no longer expose event_id');
select extensions.hasnt_column('public', 'sales', 'event_id',
  'sales no longer expose event_id');

select extensions.ok(to_regprocedure(signature) is null,
  'legacy function is removed: ' || signature)
from (values
  ('public.prepare_legacy_cash_session_insert()'),
  ('public.prepare_sale_insert()'),
  ('public.close_event(uuid)'),
  ('public.open_cash_session_v2(integer,uuid)'),
  ('public.finalize_sale_v2(uuid,jsonb,jsonb)'),
  ('public.finalize_sale(uuid,uuid,uuid,timestamptz,jsonb,jsonb,integer)')
) as legacy(signature);

select extensions.ok(not exists (
  select 1 from pg_catalog.pg_trigger
  where tgrelid = to_regclass(legacy.relation) and tgname = legacy.name
), 'legacy trigger is removed: ' || legacy.name)
from (values
  ('public.cash_sessions', 'cash_sessions_prepare_legacy_insert'),
  ('public.sales', 'sales_prepare_insert')
) as legacy(relation, name);

select extensions.ok(to_regclass('public.' || name) is null,
  'legacy index is removed: ' || name)
from (values
  ('cash_sessions_one_open_per_event_operator_idx'),
  ('cash_sessions_event_idx'),
  ('sales_event_completed_at_idx')
) as legacy(name);

select extensions.ok(not exists (
  select 1 from pg_catalog.pg_constraint
  where conrelid = to_regclass(legacy.relation) and conname = legacy.name
), 'legacy foreign key is removed: ' || legacy.name)
from (values
  ('public.cash_sessions', 'cash_sessions_event_id_fkey'),
  ('public.sales', 'sales_event_id_fkey')
) as legacy(relation, name);

select extensions.ok(
  to_regprocedure('public.finalize_sale_v3(uuid,uuid,jsonb,jsonb)') is not null,
  'the exact V3 sale RPC remains available');
select extensions.is(pg_get_function_result(
  'public.finalize_sale_v3(uuid,uuid,jsonb,jsonb)'::regprocedure), 'uuid',
  'V3 sale RPC returns the sale identifier');
select extensions.ok(pg_get_functiondef(
  'public.finalize_sale_v3(uuid,uuid,jsonb,jsonb)'::regprocedure)
  not ilike '%event_id%', 'V3 sale RPC has no event_id dependency');
select extensions.is((select prosecdef from pg_catalog.pg_proc
  where oid = 'public.finalize_sale_v3(uuid,uuid,jsonb,jsonb)'::regprocedure),
  true, 'V3 sale RPC remains security definer');
select extensions.is((select array_to_string(proconfig, ',')
  from pg_catalog.pg_proc
  where oid = 'public.finalize_sale_v3(uuid,uuid,jsonb,jsonb)'::regprocedure),
  'search_path=pg_catalog, public, pg_temp', 'V3 keeps a controlled search_path');
select extensions.ok(has_function_privilege('authenticated',
  'public.finalize_sale_v3(uuid,uuid,jsonb,jsonb)', 'EXECUTE'),
  'authenticated users keep V3 sale access');
select extensions.ok(not has_function_privilege('anon',
  'public.finalize_sale_v3(uuid,uuid,jsonb,jsonb)', 'EXECUTE'),
  'anonymous V3 sale execution remains blocked');

select extensions.is((select relrowsecurity from pg_catalog.pg_class
  where oid = to_regclass('public.' || name)), true,
  'financial RLS remains enabled: ' || name)
from (values ('cash_sessions'), ('sales')) as financial(name);

select extensions.ok(to_regclass('public.' || name) is not null,
  'current operational index remains: ' || name)
from (values
  ('cash_sessions_one_open_per_operator_idx'),
  ('cash_sessions_business_date_operator_idx'),
  ('cash_sessions_operator_business_date_opened_at_idx'),
  ('cash_sessions_status_opened_at_idx'),
  ('sales_completed_at_idx'),
  ('sales_operator_completed_at_idx'),
  ('sales_cash_session_completed_at_idx')
) as current_indexes(name);

select * from extensions.finish();
rollback;
