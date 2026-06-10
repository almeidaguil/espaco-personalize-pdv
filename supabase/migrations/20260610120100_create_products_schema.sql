create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (length(trim(name)) > 0)
);

create unique index categories_name_unique_idx on public.categories(lower(name));
create index categories_active_idx on public.categories(is_active);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  sku text,
  price_in_cents integer not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_blank check (length(trim(name)) > 0),
  constraint products_price_not_negative check (price_in_cents >= 0),
  constraint products_sku_length check (
    sku is null
    or length(trim(sku)) between 1 and 64
  )
);

create unique index products_sku_unique_idx on public.products(sku)
where sku is not null;

create index products_category_idx on public.products(category_id);
create index products_active_idx on public.products(is_active);
create index products_name_idx on public.products(lower(name));

create trigger categories_set_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;

revoke all on public.categories from anon;
revoke all on public.categories from authenticated;
revoke all on public.products from anon;
revoke all on public.products from authenticated;

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.products to authenticated;

create policy "Authenticated users can read categories"
  on public.categories
  for select
  to authenticated
  using (true);

create policy "Admins can manage categories"
  on public.categories
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create policy "Authenticated users can read products"
  on public.products
  for select
  to authenticated
  using (true);

create policy "Admins can manage products"
  on public.products
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
