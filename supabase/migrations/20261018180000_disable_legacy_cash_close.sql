revoke execute on function public.close_cash_session(
  uuid,
  integer,
  timestamp with time zone,
  text
) from public, anon, authenticated;

notify pgrst, 'reload schema';
