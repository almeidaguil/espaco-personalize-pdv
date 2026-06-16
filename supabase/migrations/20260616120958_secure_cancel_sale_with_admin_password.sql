alter function public.cancel_sale(
  uuid,
  timestamptz,
  text
) security definer;

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
