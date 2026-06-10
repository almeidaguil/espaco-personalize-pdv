create type public.user_role as enum ('admin', 'operator');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;

grant select on public.profiles to authenticated;
grant update(full_name) on public.profiles to authenticated;

create policy "Authenticated users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "Authenticated users can update own profile name"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  safe_role public.user_role;
begin
  requested_role := new.raw_user_meta_data ->> 'role';

  if requested_role in ('admin', 'operator') then
    safe_role := requested_role::public.user_role;
  else
    safe_role := 'operator';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    safe_role
  );

  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row
  execute function public.handle_new_user_profile();
