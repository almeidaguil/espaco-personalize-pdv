begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(5);
select extensions.col_type_is('public', 'products', 'description', 'text', 'description is text');
select extensions.col_is_null('public', 'products', 'description', 'description is nullable');
insert into public.products (id, name, price_in_cents, description)
values ('00000000-0000-4000-8000-000000000701', 'Description contract', 3500, E'Algodão\nManga curta');
select extensions.is((select description from public.products where id = '00000000-0000-4000-8000-000000000701'), E'Algodão\nManga curta', 'description survives insertion');
update public.products set description = 'Updated' where id = '00000000-0000-4000-8000-000000000701';
select extensions.is((select description from public.products where id = '00000000-0000-4000-8000-000000000701'), 'Updated', 'description can be updated');
update public.products set description = null where id = '00000000-0000-4000-8000-000000000701';
select extensions.is((select description from public.products where id = '00000000-0000-4000-8000-000000000701'), null::text, 'description can be removed');
select * from extensions.finish();
rollback;
