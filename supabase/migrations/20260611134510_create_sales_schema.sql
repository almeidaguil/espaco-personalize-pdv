create type public.sale_status as enum (
  'completed',
  'canceled'
);

create type public.payment_method as enum (
  'cash'
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  cash_session_id uuid not null references public.cash_sessions(id) on delete restrict,
  operator_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  status public.sale_status not null default 'completed',
  total_in_cents integer not null,
  completed_at timestamptz not null default now(),
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_total_not_negative check (total_in_cents >= 0),
  constraint sales_canceled_at_consistent check (
    (
      status = 'completed'
      and canceled_at is null
    )
    or (
      status = 'canceled'
      and canceled_at is not null
    )
  )
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity integer not null,
  unit_price_in_cents integer not null,
  total_in_cents integer not null,
  created_at timestamptz not null default now(),
  constraint sale_items_product_name_not_blank check (length(trim(product_name)) > 0),
  constraint sale_items_quantity_positive check (quantity > 0),
  constraint sale_items_unit_price_not_negative check (unit_price_in_cents >= 0),
  constraint sale_items_total_matches_quantity check (
    total_in_cents = quantity * unit_price_in_cents
  )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  method public.payment_method not null,
  amount_in_cents integer not null,
  change_in_cents integer not null default 0,
  created_at timestamptz not null default now(),
  constraint payments_amount_not_negative check (amount_in_cents >= 0),
  constraint payments_change_not_negative check (change_in_cents >= 0)
);

create index sales_event_completed_at_idx
  on public.sales(event_id, completed_at desc);

create index sales_cash_session_idx on public.sales(cash_session_id);
create index sales_operator_idx on public.sales(operator_id);
create index sales_status_idx on public.sales(status);
create index sale_items_sale_idx on public.sale_items(sale_id);
create index sale_items_product_idx on public.sale_items(product_id);
create index payments_sale_idx on public.payments(sale_id);
create index payments_method_idx on public.payments(method);

create trigger sales_set_updated_at
  before update on public.sales
  for each row
  execute function public.set_updated_at();

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;

revoke all on public.sales from anon;
revoke all on public.sales from authenticated;
revoke all on public.sale_items from anon;
revoke all on public.sale_items from authenticated;
revoke all on public.payments from anon;
revoke all on public.payments from authenticated;

grant select, insert, update on public.sales to authenticated;
grant select, insert on public.sale_items to authenticated;
grant select, insert on public.payments to authenticated;

create policy "Authenticated users can read sales"
  on public.sales
  for select
  to authenticated
  using (true);

create policy "Authenticated users can read sale items"
  on public.sale_items
  for select
  to authenticated
  using (true);

create policy "Authenticated users can read payments"
  on public.payments
  for select
  to authenticated
  using (true);

create policy "Operators can create own sales"
  on public.sales
  for insert
  to authenticated
  with check (
    operator_id = (select auth.uid())
    and exists (
      select 1
      from public.cash_sessions
      where cash_sessions.id = sales.cash_session_id
        and cash_sessions.event_id = sales.event_id
        and cash_sessions.operator_id = (select auth.uid())
        and cash_sessions.status = 'open'
    )
  );

create policy "Operators can update own sales"
  on public.sales
  for update
  to authenticated
  using (
    operator_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    operator_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "Operators can create items for own sales"
  on public.sale_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sales
      where sales.id = sale_items.sale_id
        and sales.operator_id = (select auth.uid())
    )
  );

create policy "Operators can create payments for own sales"
  on public.payments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sales
      where sales.id = payments.sale_id
        and sales.operator_id = (select auth.uid())
    )
  );
