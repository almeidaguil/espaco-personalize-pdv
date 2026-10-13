do $$
begin
  if exists (
    select 1
    from public.products
    where sku is not null
    group by upper(btrim(sku))
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'Product SKU normalization collision';
  end if;
end;
$$;

update public.products
set sku = upper(btrim(sku))
where sku is not null
  and sku is distinct from upper(btrim(sku));

alter table public.products
  add constraint products_sku_canonical check (
    sku is null
    or (
      sku = upper(btrim(sku))
      and length(sku) between 1 and 64
    )
  );
