alter type public.stock_movement_type add value if not exists 'sale_cancellation';

alter table public.stock_movements
  drop constraint stock_movements_sale_reference_consistent,
  add constraint stock_movements_sale_reference_consistent check (
    (
      type::text = 'sale'
      and sale_id is not null
      and quantity_change < 0
    )
    or (
      type::text = 'sale_cancellation'
      and sale_id is not null
      and quantity_change > 0
    )
    or (
      type::text not in ('sale', 'sale_cancellation')
      and sale_id is null
    )
  );

drop policy "Authenticated users can create allowed stock movements"
  on public.stock_movements;

create policy "Authenticated users can create allowed stock movements"
  on public.stock_movements
  for insert
  to authenticated
  with check (
    (
      type::text not in ('sale', 'sale_cancellation')
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
    or (
      type::text = 'sale_cancellation'
      and quantity_change > 0
      and exists (
        select 1
        from public.sales
        where sales.id = stock_movements.sale_id
          and (
            sales.operator_id = (select auth.uid())
            or exists (
              select 1
              from public.profiles
              where profiles.id = (select auth.uid())
                and profiles.role = 'admin'
            )
          )
      )
    )
  );
