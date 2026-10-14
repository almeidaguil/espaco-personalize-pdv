do $$
begin
  if exists (
    select 1
    from (
      select nullif(
        upper(
          btrim(
            sku,
            E' \t\n\v\f\r' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
          )
        ),
        ''
      ) as canonical_sku
      from public.products
      where sku is not null
    ) as normalized_products
    where canonical_sku is not null
    group by canonical_sku
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'Product SKU normalization collision';
  end if;
end;
$$;

update public.products
set sku = nullif(
  upper(
    btrim(
      sku,
      E' \t\n\v\f\r' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    )
  ),
  ''
)
where sku is not null
  and sku is distinct from nullif(
    upper(
      btrim(
        sku,
        E' \t\n\v\f\r' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
      )
    ),
    ''
  );

alter table public.products
  add constraint products_sku_canonical check (
    sku is null
    or (
      nullif(
        upper(
          btrim(
            sku,
            E' \t\n\v\f\r' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
          )
        ),
        ''
      ) is not null
      and sku = nullif(
        upper(
          btrim(
            sku,
            E' \t\n\v\f\r' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
          )
        ),
        ''
      )
      and length(sku) between 1 and 64
    )
  );
