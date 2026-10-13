begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(5);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_sku_canonical'
      and contype = 'c'
  ),
  'products enforce the canonical SKU format'
);

select extensions.lives_ok(
  $$
    insert into public.products (name, price_in_cents, sku)
    values ('Valid uppercase SKU', 1000, 'RM-VALIDO-01')
  $$,
  'an uppercase SKU is accepted'
);

select extensions.throws_ok(
  $$
    insert into public.products (name, price_in_cents, sku)
    values ('Invalid lowercase SKU', 1000, 'rm-invalido-01')
  $$,
  '23514',
  null,
  'a lowercase SKU is rejected'
);

select extensions.throws_ok(
  $$
    insert into public.products (name, price_in_cents, sku)
    values ('Invalid padded SKU', 1000, ' RM-INVALIDO-02 ')
  $$,
  '23514',
  null,
  'an SKU with surrounding whitespace is rejected'
);

select extensions.lives_ok(
  $$
    insert into public.products (name, price_in_cents, sku)
    values ('Product without SKU', 1000, null)
  $$,
  'a null SKU remains accepted'
);

select * from extensions.finish();
rollback;
