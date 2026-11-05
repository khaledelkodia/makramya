alter table public.orders
  add column if not exists customer_email text not null default '',
  add column if not exists customer_id uuid references auth.users(id) on delete set null;

create index if not exists orders_customer_id_created_at
  on public.orders(customer_id, created_at desc)
  where customer_id is not null;

grant select on public.orders, public.order_items, public.order_status_history to authenticated;

drop policy if exists "Customers can read their own orders" on public.orders;
create policy "Customers can read their own orders" on public.orders
  for select to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists "Customers can read their own order items" on public.order_items;
create policy "Customers can read their own order items" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.customer_id = (select auth.uid())
  ));

drop policy if exists "Customers can read their own order history" on public.order_status_history;
create policy "Customers can read their own order history" on public.order_status_history
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and o.customer_id = (select auth.uid())
  ));

-- The wrapper records an email while keeping price, stock, and delivery calculations in the existing RPC.
drop function if exists public.place_order(text,text,text,text,text,text,jsonb);
create function public.place_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_governorate text,
  p_customer_email text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_customer_email, '')));
  v_order_id uuid;
  v_customer_id uuid;
  v_user_email text;
begin
  if length(v_email) not between 5 and 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;

  if auth.uid() is not null then
    select lower(u.email) into v_user_email
    from auth.users u
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null;
    if v_user_email = v_email then
      v_customer_id := (select auth.uid());
    end if;
  end if;

  v_order_id := public.place_order(
    p_customer_name,
    p_phone,
    p_address,
    p_governorate,
    p_notes,
    p_items
  );

  update public.orders
  set customer_email = v_email,
      customer_id = v_customer_id
  where id = v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.place_order(text,text,text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,text,text,jsonb) to anon, authenticated;

create or replace function public.claim_customer_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_claimed integer;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required';
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null;

  if v_email is null then
    raise exception 'email_not_verified';
  end if;

  update public.orders
  set customer_id = (select auth.uid())
  where customer_id is null
    and customer_email = v_email;

  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;

revoke all on function public.claim_customer_orders() from public, anon, authenticated;
grant execute on function public.claim_customer_orders() to authenticated;

notify pgrst, 'reload schema';
