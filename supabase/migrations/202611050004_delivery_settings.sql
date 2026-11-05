create table if not exists public.delivery_settings (
  id text primary key default 'default' check (id = 'default'),
  base_fee numeric(10,2) not null default 0 check (base_fee >= 0),
  free_shipping_threshold numeric(10,2) check (free_shipping_threshold is null or free_shipping_threshold > 0),
  min_delivery_days smallint not null default 3 check (min_delivery_days between 1 and 90),
  max_delivery_days smallint not null default 7 check (max_delivery_days between 1 and 90),
  coverage_area text not null default 'جميع محافظات مصر' check (char_length(btrim(coverage_area)) between 2 and 500),
  customer_note text not null default 'هنكلمك نأكد تفاصيل التوصيل قبل تجهيز الطلب.' check (char_length(customer_note) <= 1000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (min_delivery_days <= max_delivery_days)
);

alter table public.delivery_settings enable row level security;
grant select on public.delivery_settings to anon, authenticated;
grant insert, update on public.delivery_settings to authenticated;

drop policy if exists "Anyone can read delivery settings" on public.delivery_settings;
create policy "Anyone can read delivery settings" on public.delivery_settings
  for select to anon, authenticated using (true);

drop policy if exists "Order staff can manage delivery settings" on public.delivery_settings;
create policy "Order staff can manage delivery settings" on public.delivery_settings
  for all to authenticated
  using ((select public.has_staff_role(array['owner','manager','orders'])))
  with check ((select public.has_staff_role(array['owner','manager','orders'])));

insert into public.delivery_settings (id)
values ('default')
on conflict (id) do nothing;

-- The order total and delivery charge are calculated on the database side.
create or replace function public.place_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_subtotal numeric(10,2) := 0;
  v_base_delivery_fee numeric(10,2) := 0;
  v_free_shipping_threshold numeric(10,2);
  v_delivery_fee numeric(10,2) := 0;
  v_line record;
  v_product public.products%rowtype;
  v_qty integer;
  v_color text;
  v_size text;
begin
  if length(trim(coalesce(p_customer_name, ''))) not between 2 and 120 then raise exception 'invalid_name'; end if;
  if length(trim(coalesce(p_phone, ''))) not between 7 and 30 then raise exception 'invalid_phone'; end if;
  if length(trim(coalesce(p_address, ''))) not between 5 and 500 then raise exception 'invalid_address'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'invalid_items'; end if;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_line.value->>'quantity')::integer;
    v_color := trim(coalesce(v_line.value->>'color', ''));
    v_size := trim(coalesce(v_line.value->>'size', ''));
    if v_qty not between 1 and 25 or length(v_color) not between 1 and 80 or length(v_size) not between 1 and 80 then raise exception 'invalid_item_options'; end if;
    select * into v_product from public.products where id = (v_line.value->>'product_id')::uuid and status = 'active' for update;
    if not found then raise exception 'product_unavailable'; end if;
    if not exists (select 1 from jsonb_array_elements(v_product.colors) c where c->>'name' = v_color) then raise exception 'invalid_color'; end if;
    if not (v_size = any(v_product.sizes) or ('مقاس مخصوص' = any(v_product.sizes) and v_size ~ '^[0-9]{1,4} × [0-9]{1,4} سم$')) then raise exception 'invalid_size'; end if;
    if v_product.track_inventory then
      if v_qty > v_product.inventory_count then raise exception 'insufficient_stock'; end if;
      update public.products set inventory_count = inventory_count - v_qty, updated_at = now() where id = v_product.id;
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  select base_fee, free_shipping_threshold
    into v_base_delivery_fee, v_free_shipping_threshold
    from public.delivery_settings where id = 'default';
  v_base_delivery_fee := coalesce(v_base_delivery_fee, 0);

  if v_free_shipping_threshold is null or v_subtotal < v_free_shipping_threshold then
    v_delivery_fee := v_base_delivery_fee;
  end if;

  insert into public.orders (id, customer_name, phone, address, notes, subtotal, delivery_fee, total)
  values (v_order_id, trim(p_customer_name), trim(p_phone), trim(p_address), left(coalesce(p_notes, ''), 1000), v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee);

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_line.value->>'quantity')::integer;
    v_color := trim(v_line.value->>'color');
    v_size := trim(v_line.value->>'size');
    select * into v_product from public.products where id = (v_line.value->>'product_id')::uuid and status = 'active';
    insert into public.order_items (order_id, product_id, product_name, unit_price, color, size, quantity, line_total)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_color, v_size, v_qty, v_product.price * v_qty);
  end loop;
  return v_order_id;
end;
$$;

revoke all on function public.place_order(text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,jsonb) to anon, authenticated;
