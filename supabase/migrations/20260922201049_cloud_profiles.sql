-- Slice 03: one cloud identity profile, no project or inventory tables.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  primary_board_id text check (primary_board_id in ('esp32-dev-module', 'raspberry-pi-pico', 'arduino-uno')),
  setup_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completed_profile_has_board check (not setup_completed or primary_board_id is not null)
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (display_name, primary_board_id, setup_completed) on public.profiles to authenticated;
grant update (display_name, primary_board_id, setup_completed) on public.profiles to authenticated;

create policy profiles_read_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- No DELETE grant or client deletion flow until account deletion is implemented.
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid()) = id);

create function private.touch_profile() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function private.touch_profile();

create function private.create_user_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_user_profile() from public, anon, authenticated;
revoke all on function private.touch_profile() from public, anon, authenticated;
create trigger create_kinetable_profile after insert on auth.users for each row execute function private.create_user_profile();
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;
