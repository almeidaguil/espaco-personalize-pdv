create type public.stock_movement_type as enum (
  'initial_adjustment',
  'manual_adjustment'
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  type public.stock_movement_type not null,
  quantity_change integer not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint stock_movements_quantity_change_not_zero check (quantity_change <> 0)
);

create index stock_movements_product_created_at_idx
  on public.stock_movements(product_id, created_at desc);

create index stock_movements_type_idx
  on public.stock_movements(type);

create index stock_movements_created_by_idx
  on public.stock_movements(created_by);

alter table public.stock_movements enable row level security;

revoke all on public.stock_movements from anon;
revoke all on public.stock_movements from authenticated;

grant select, insert on public.stock_movements to authenticated;

create policy "Authenticated users can read stock movements"
  on public.stock_movements
  for select
  to authenticated
  using (true);

create policy "Admins can create stock movements"
  on public.stock_movements
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
