alter type public.stock_movement_type add value if not exists 'sale';

alter table public.stock_movements
  add column sale_id uuid references public.sales(id) on delete restrict,
  add constraint stock_movements_sale_reference_consistent check (
    (
      type::text = 'sale'
      and sale_id is not null
      and quantity_change < 0
    )
    or (
      type::text <> 'sale'
      and sale_id is null
    )
  );

create index stock_movements_sale_idx on public.stock_movements(sale_id);

drop policy "Admins can create stock movements" on public.stock_movements;

create policy "Authenticated users can create allowed stock movements"
  on public.stock_movements
  for insert
  to authenticated
  with check (
    (
      type::text <> 'sale'
      and exists (
        select 1
        from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.role = 'admin'
      )
    )
    or (
      type::text = 'sale'
      and quantity_change < 0
      and exists (
        select 1
        from public.sales
        where sales.id = stock_movements.sale_id
          and sales.operator_id = (select auth.uid())
      )
    )
  );
