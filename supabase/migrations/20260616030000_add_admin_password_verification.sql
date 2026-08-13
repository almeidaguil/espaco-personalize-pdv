create extension if not exists pgcrypto with schema extensions;

create or replace function public.verify_admin_password(
  p_admin_password text
)
returns boolean
language sql
security definer
stable
set search_path = public, auth, extensions, pg_temp
as $$
  select exists (
    select 1
    from auth.users as admin_user
    join public.profiles
      on profiles.id = admin_user.id
    where profiles.role = 'admin'
      and (
        admin_user.banned_until is null
        or admin_user.banned_until <= now()
      )
      and coalesce(admin_user.encrypted_password, '') <> ''
      and admin_user.encrypted_password = extensions.crypt(
        btrim(coalesce(p_admin_password, '')),
        admin_user.encrypted_password
      )
  );
$$;

revoke all on function public.verify_admin_password(text) from public;
revoke execute on function public.verify_admin_password(text) from anon;
revoke execute on function public.verify_admin_password(text) from authenticated;
