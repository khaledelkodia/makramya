-- Store staff roles. Existing admins become owners so the current account keeps full access.
alter table public.admins add column if not exists role text not null default 'owner';
update public.admins set role = 'owner' where role is null or role not in ('owner', 'manager', 'products', 'orders');
alter table public.admins alter column role set default 'owner';
alter table public.admins alter column role set not null;
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('owner', 'manager', 'products', 'orders'));

create or replace function public.has_staff_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins
    where user_id = (select auth.uid())
      and role = any (allowed_roles)
  );
$$;

revoke all on function public.has_staff_role(text[]) from public;
grant execute on function public.has_staff_role(text[]) to authenticated;

drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Staff can manage products" on public.products;
create policy "Staff can manage products" on public.products
  for all to authenticated
  using ((select public.has_staff_role(array['owner', 'manager', 'products'])))
  with check ((select public.has_staff_role(array['owner', 'manager', 'products'])));

drop policy if exists "Admins can read and update orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Staff can read orders" on public.orders;
drop policy if exists "Staff can update orders" on public.orders;
create policy "Staff can read orders" on public.orders
  for select to authenticated
  using ((select public.has_staff_role(array['owner', 'manager', 'orders'])));
create policy "Staff can update orders" on public.orders
  for update to authenticated
  using ((select public.has_staff_role(array['owner', 'manager', 'orders'])))
  with check ((select public.has_staff_role(array['owner', 'manager', 'orders'])));

drop policy if exists "Admins can read order items" on public.order_items;
drop policy if exists "Admins can update order items" on public.order_items;
drop policy if exists "Staff can read order items" on public.order_items;
drop policy if exists "Staff can update order items" on public.order_items;
create policy "Staff can read order items" on public.order_items
  for select to authenticated
  using ((select public.has_staff_role(array['owner', 'manager', 'orders'])));
create policy "Staff can update order items" on public.order_items
  for update to authenticated
  using ((select public.has_staff_role(array['owner', 'manager', 'orders'])))
  with check ((select public.has_staff_role(array['owner', 'manager', 'orders'])));

drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Admins can update product images" on storage.objects;
drop policy if exists "Admins can delete product images" on storage.objects;
drop policy if exists "Staff can upload product images" on storage.objects;
drop policy if exists "Staff can update product images" on storage.objects;
drop policy if exists "Staff can delete product images" on storage.objects;
create policy "Staff can upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'products' and (select public.has_staff_role(array['owner', 'manager', 'products'])));
create policy "Staff can update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'products' and (select public.has_staff_role(array['owner', 'manager', 'products'])))
  with check (bucket_id = 'products' and (select public.has_staff_role(array['owner', 'manager', 'products'])));
create policy "Staff can delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'products' and (select public.has_staff_role(array['owner', 'manager', 'products'])));
