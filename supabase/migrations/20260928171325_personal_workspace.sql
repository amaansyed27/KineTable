alter table public.projects add column revision bigint not null default 1 check (revision > 0);

create table public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  document jsonb not null,
  reason text not null check (char_length(reason) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (project_id, revision)
);
create index project_versions_owner_project_recent on public.project_versions (owner_id, project_id, revision desc);
insert into public.project_versions (project_id, owner_id, revision, document, reason, created_at)
select id, owner_id, 1, document, 'Saved project', updated_at from public.projects;
alter table public.project_versions enable row level security;
revoke all on public.project_versions from public, anon, authenticated;
grant select on public.project_versions to authenticated;
create policy project_versions_read_own on public.project_versions for select to authenticated
  using ((select auth.uid()) = owner_id);

-- All browser mutations now pass through one compare-and-save transaction.
revoke insert, update, delete on public.projects from authenticated;
revoke insert (id, name, primary_board_id, schema_version, document) on public.projects from authenticated;
revoke update (name, primary_board_id, schema_version, document, archived) on public.projects from authenticated;
create or replace function public.checkpoint_project(
  p_id uuid, p_document jsonb, p_reason text, p_expected_revision bigint default null
) returns public.projects language plpgsql security definer set search_path = '' as $$
declare
  result public.projects;
  owner uuid := auth.uid();
  schema_number integer;
  board text;
  project_name text;
begin
  if owner is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_document is null or jsonb_typeof(p_document) <> 'object' or p_document->>'id' <> p_id::text
     or pg_catalog.octet_length(p_document::text) > 1000000
     or p_reason is null or char_length(p_reason) not between 1 and 80 then
    raise exception 'INVALID_PROJECT' using errcode = '22023';
  end if;
  schema_number := (p_document->>'schemaVersion')::integer;
  board := p_document->'boardIds'->>0;
  project_name := p_document->>'name';
  if schema_number not in (1,2,3,4) or board not in ('esp32-dev-module','raspberry-pi-pico','arduino-uno')
     or project_name is null or char_length(trim(project_name)) not between 1 and 120 then
    raise exception 'INVALID_PROJECT' using errcode = '22023';
  end if;
  select * into result from public.projects where id = p_id for update;
  if found then
    if result.owner_id <> owner then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
    if p_expected_revision is distinct from result.revision then raise exception 'PROJECT_CONFLICT' using errcode = '40001'; end if;
    update public.projects set name = project_name, primary_board_id = board,
      schema_version = schema_number, document = p_document, revision = result.revision + 1
      where id = p_id returning * into result;
  else
    if p_expected_revision is not null then raise exception 'PROJECT_CONFLICT' using errcode = '40001'; end if;
    insert into public.projects (id, owner_id, name, primary_board_id, schema_version, document)
      values (p_id, owner, project_name, board, schema_number, p_document)
      returning * into result;
  end if;
  insert into public.project_versions (project_id, owner_id, revision, document, reason)
    values (result.id, owner, result.revision, p_document, p_reason);
  return result;
end;
$$;
revoke execute on function public.checkpoint_project(uuid,jsonb,text,bigint) from public, anon;
grant execute on function public.checkpoint_project(uuid,jsonb,text,bigint) to authenticated;
