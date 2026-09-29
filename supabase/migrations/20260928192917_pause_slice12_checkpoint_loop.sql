create or replace function public.checkpoint_project(
  p_id uuid,
  p_document jsonb,
  p_reason text,
  p_expected_revision bigint default null
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.projects;
  owner uuid := auth.uid();
begin
  if owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into result
  from public.projects
  where id = p_id;

  if found then
    if result.owner_id <> owner then
      raise exception 'NOT_FOUND' using errcode = '42501';
    end if;
    -- Slice 12 is paused. Return the current cloud head without writing or
    -- raising PROJECT_CONFLICT so stale retry loops cannot hammer Postgres.
    return result;
  end if;

  -- No project head exists. While Slice 12 is paused, do not create one via
  -- this experimental checkpoint RPC.
  return null;
end;
$$;
