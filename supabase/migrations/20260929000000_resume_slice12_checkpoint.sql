-- Replace the paused RPC with a result that makes stale revisions ordinary data.
-- The old 40001 exception was treated as retryable by the request path.
drop function public.checkpoint_project(uuid,jsonb,text,bigint);
create function public.checkpoint_project(
  p_id uuid, p_document jsonb, p_reason text, p_expected_revision bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
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
    if p_expected_revision is distinct from result.revision then
      return jsonb_build_object('status','conflict','project',to_jsonb(result));
    end if;
    update public.projects set name = project_name, primary_board_id = board,
      schema_version = schema_number, document = p_document, revision = result.revision + 1
      where id = p_id returning * into result;
  else
    if p_expected_revision is not null then
      return jsonb_build_object('status','conflict','project',null);
    end if;
    insert into public.projects (id, owner_id, name, primary_board_id, schema_version, document)
      values (p_id, owner, project_name, board, schema_number, p_document)
      on conflict (id) do nothing returning * into result;
    if not found then
      select * into result from public.projects where id = p_id for update;
      if result.owner_id <> owner then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
      return jsonb_build_object('status','conflict','project',to_jsonb(result));
    end if;
  end if;
  insert into public.project_versions (project_id, owner_id, revision, document, reason)
    values (result.id, owner, result.revision, p_document, p_reason);
  return jsonb_build_object('status','saved','project',to_jsonb(result));
end;
$$;
revoke execute on function public.checkpoint_project(uuid,jsonb,text,bigint) from public, anon;
grant execute on function public.checkpoint_project(uuid,jsonb,text,bigint) to authenticated;
