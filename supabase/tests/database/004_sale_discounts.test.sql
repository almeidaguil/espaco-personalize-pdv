begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(23);

select extensions.has_column(
  'public', 'sales', 'subtotal_in_cents',
  'sales stores the server-calculated subtotal'
);
select extensions.has_column(
  'public', 'sales', 'discount_in_cents',
  'sales stores the granted discount'
);
select extensions.col_not_null(
  'public', 'sales', 'subtotal_in_cents',
  'sale subtotal is required'
);
select extensions.col_not_null(
  'public', 'sales', 'discount_in_cents',
  'sale discount is required'
);
select extensions.col_default_is(
  'public', 'sales', 'discount_in_cents', '0',
  'sale discount defaults to zero for compatible inserts'
);

select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.sales'::regclass
      and conname = 'sales_subtotal_positive'
      and contype = 'c'
  ),
  'sale subtotal must be positive'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.sales'::regclass
      and conname = 'sales_discount_valid'
      and contype = 'c'
  ),
  'sale discount must be non-negative and below subtotal'
);
select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.sales'::regclass
      and conname = 'sales_total_matches_discount'
      and contype = 'c'
  ),
  'sale total must equal subtotal minus discount and stay positive'
);

select extensions.ok(
  to_regprocedure(
    'public.finalize_sale_v4(uuid,uuid,jsonb,jsonb,integer)'
  ) is not null,
  'the discounted sale RPC exists'
);
select extensions.is(
  pg_get_function_result(
    'public.finalize_sale_v4(uuid,uuid,jsonb,jsonb,integer)'::regprocedure
  ),
  'uuid',
  'the discounted sale RPC returns the sale identifier'
);
select extensions.is(
  pg_get_function_arguments(
    'public.finalize_sale_v4(uuid,uuid,jsonb,jsonb,integer)'::regprocedure
  ),
  'p_sale_id uuid, p_cash_session_id uuid, p_items jsonb, p_payment jsonb, p_discount_in_cents integer',
  'the discounted sale RPC accepts only trusted sale intent'
);
select extensions.is(
  (
    select procedures.prosecdef
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.finalize_sale_v4(uuid,uuid,jsonb,jsonb,integer)'::regprocedure
  ),
  true,
  'finalize_sale_v4 is security definer'
);
select extensions.is(
  (
    select array_to_string(procedures.proconfig, ',')
    from pg_catalog.pg_proc as procedures
    where procedures.oid =
      'public.finalize_sale_v4(uuid,uuid,jsonb,jsonb,integer)'::regprocedure
  ),
  'search_path=pg_catalog, public, pg_temp',
  'finalize_sale_v4 has a controlled search_path'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.finalize_sale_v4(uuid,uuid,jsonb,jsonb,integer)',
    'EXECUTE'
  ),
  'authenticated users can finalize discounted sales'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.finalize_sale_v4(uuid,uuid,jsonb,jsonb,integer)',
    'EXECUTE'
  ),
  'anonymous users cannot finalize discounted sales'
);

select extensions.ok(
  to_regprocedure(
    'public.finalize_sale_transaction(uuid,uuid,jsonb,jsonb,integer,text)'
  ) is not null,
  'the shared transaction helper exists'
);
select extensions.is(
  pg_get_function_result(
    'public.finalize_sale_transaction(uuid,uuid,jsonb,jsonb,integer,text)'::regprocedure
  ),
  'uuid',
  'the shared transaction helper returns the sale identifier'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.finalize_sale_transaction(uuid,uuid,jsonb,jsonb,integer,text)',
    'EXECUTE'
  ),
  'authenticated users cannot execute the transaction helper directly'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.finalize_sale_transaction(uuid,uuid,jsonb,jsonb,integer,text)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the transaction helper directly'
);
select extensions.ok(
  not has_function_privilege(
    'public',
    'public.finalize_sale_transaction(uuid,uuid,jsonb,jsonb,integer,text)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute the transaction helper directly'
);
select extensions.ok(
  pg_get_functiondef(
    'public.finalize_sale_payments_transaction(uuid,uuid,jsonb,jsonb,integer,text)'::regprocedure
  ) ilike '%for update of products%',
  'the split payment transaction helper locks the product price snapshot'
);
select extensions.ok(
  pg_get_functiondef(
    'public.finalize_sale_transaction(uuid,uuid,jsonb,jsonb,integer,text)'::regprocedure
  ) ilike '%finalize_sale_payments_transaction%',
  'the legacy transaction helper delegates to the split payment transaction'
);

select extensions.ok(
  to_regprocedure('public.finalize_sale_v3(uuid,uuid,jsonb,jsonb)') is not null,
  'the zero-discount V3 compatibility wrapper remains available'
);

select * from extensions.finish();
rollback;
