alter table public.projects drop constraint projects_schema_version_check;
alter table public.projects add constraint projects_schema_version_check check (schema_version in (1, 2, 3));
