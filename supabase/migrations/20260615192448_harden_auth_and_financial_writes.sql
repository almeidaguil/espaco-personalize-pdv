create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    'operator'
  );

  return new;
end;
$$;

alter function public.set_updated_at()
  set search_path = public, pg_temp;

drop policy if exists "Authenticated users can read own profile"
  on public.profiles;

drop policy if exists "Authenticated users can update own profile name"
  on public.profiles;

create policy "Authenticated users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Authenticated users can update own profile name"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Admins can manage categories"
  on public.categories;

drop policy if exists "Admins can manage products"
  on public.products;

create policy "Admins can create categories"
  on public.categories
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "Admins can update categories"
  on public.categories
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "Admins can delete categories"
  on public.categories
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "Admins can create products"
  on public.products
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "Admins can update products"
  on public.products
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "Admins can delete products"
  on public.products
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

alter function public.finalize_sale(
  uuid,
  uuid,
  uuid,
  timestamptz,
  jsonb,
  jsonb,
  integer
) security definer;

alter function public.cancel_sale(
  uuid,
  timestamptz
) security definer;

revoke insert, update on public.sales from authenticated;
revoke insert on public.sale_items from authenticated;
revoke insert on public.payments from authenticated;

drop policy if exists "Operators can create own sales" on public.sales;
drop policy if exists "Operators can update own sales" on public.sales;
drop policy if exists "Operators can create items for own sales" on public.sale_items;
drop policy if exists "Operators can create payments for own sales" on public.payments;

drop policy if exists "Authenticated users can create allowed stock movements"
  on public.stock_movements;

create policy "Admins can create manual stock movements"
  on public.stock_movements
  for insert
  to authenticated
  with check (
    type::text in ('initial_adjustment', 'manual_adjustment')
    and sale_id is null
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );
