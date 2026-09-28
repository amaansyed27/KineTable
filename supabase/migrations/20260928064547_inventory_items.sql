create table public.inventory_items (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  definition_id text not null check (char_length(definition_id) between 1 and 64),
  quantity integer not null check (quantity between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, definition_id)
);
create index inventory_items_owner_recent on public.inventory_items (owner_id, updated_at desc);
alter table public.inventory_items enable row level security;
revoke all on public.inventory_items from anon, authenticated;
grant select, delete on public.inventory_items to authenticated;
grant insert (definition_id, quantity, updated_at) on public.inventory_items to authenticated;
grant update (quantity, updated_at) on public.inventory_items to authenticated;
create policy inventory_read_own on public.inventory_items for select to authenticated using ((select auth.uid()) = owner_id);
create policy inventory_insert_own on public.inventory_items for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy inventory_update_own on public.inventory_items for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy inventory_delete_own on public.inventory_items for delete to authenticated using ((select auth.uid()) = owner_id);
