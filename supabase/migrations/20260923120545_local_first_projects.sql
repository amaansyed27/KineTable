create table public.projects (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  primary_board_id text check (primary_board_id in ('esp32-dev-module', 'raspberry-pi-pico', 'arduino-uno')),
  schema_version integer not null check (schema_version = 1),
  document jsonb not null check (jsonb_typeof(document) = 'object' and (document->>'schemaVersion')::integer = schema_version and document->>'id' = id::text),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_recent on public.projects (owner_id, updated_at desc) where not archived;
alter table public.projects enable row level security;
revoke all on public.projects from anon, authenticated;
grant select, delete on public.projects to authenticated;
grant insert (id, name, primary_board_id, schema_version, document) on public.projects to authenticated;
grant update (name, primary_board_id, schema_version, document, archived) on public.projects to authenticated;
create policy projects_read_own on public.projects for select to authenticated using ((select auth.uid()) = owner_id);
create policy projects_insert_own on public.projects for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy projects_update_own on public.projects for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy projects_delete_own on public.projects for delete to authenticated using ((select auth.uid()) = owner_id);
create trigger projects_updated_at before update on public.projects for each row execute function private.touch_profile();
