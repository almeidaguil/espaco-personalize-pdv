drop function if exists public.cancel_sale(
  uuid,
  timestamptz
);

create or replace function public.cancel_sale(
  p_sale_id uuid,
  p_canceled_at timestamptz,
  p_admin_password text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_sale record;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required to cancel a sale.';
  end if;

  if p_sale_id is null then
    raise exception 'Sale is required.';
  end if;

  if p_canceled_at is null then
    raise exception 'Cancellation date is required.';
  end if;

  if coalesce(btrim(p_admin_password), '') <> '123456' then
    raise exception 'Admin password is required to cancel a sale.';
  end if;

  select id, operator_id, status
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Sale not found.';
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'Sale is already canceled.';
  end if;

  if v_sale.operator_id <> v_user_id and not exists (
    select 1
    from public.profiles
    where profiles.id = v_user_id
      and profiles.role = 'admin'
  ) then
    raise exception 'User is not allowed to cancel this sale.';
  end if;

  update public.sales
  set
    canceled_at = p_canceled_at,
    status = 'canceled'
  where id = p_sale_id
    and status = 'completed';

  if not found then
    raise exception 'Sale is already canceled.';
  end if;

  insert into public.stock_movements (
    id,
    product_id,
    type,
    quantity_change,
    sale_id,
    created_at
  )
  select
    gen_random_uuid(),
    sale_items.product_id,
    'sale_cancellation',
    sale_items.quantity,
    p_sale_id,
    p_canceled_at
  from public.sale_items
  where sale_items.sale_id = p_sale_id;

  if not found then
    raise exception 'Sale has no items to restore.';
  end if;

  return p_sale_id;
end;
$$;

revoke all on function public.cancel_sale(
  uuid,
  timestamptz,
  text
) from public;

revoke execute on function public.cancel_sale(
  uuid,
  timestamptz,
  text
) from anon;

grant execute on function public.cancel_sale(
  uuid,
  timestamptz,
  text
) to authenticated;
