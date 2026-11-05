alter table public.delivery_settings
  add column if not exists delivery_zones jsonb not null default '[]'::jsonb;

alter table public.delivery_settings
  drop constraint if exists delivery_settings_delivery_zones_check;
alter table public.delivery_settings
  add constraint delivery_settings_delivery_zones_check
  check (jsonb_typeof(delivery_zones) = 'array');

alter table public.orders
  add column if not exists governorate text not null default '';

-- Keep the previously configured flat fee while converting it to the first price group.
update public.delivery_settings
set delivery_zones = jsonb_build_array(
  jsonb_build_object(
    'governorates', to_jsonb(array[
      'القاهرة','الجيزة','الإسكندرية','القليوبية','البحيرة','كفر الشيخ','الغربية','المنوفية','الدقهلية',
      'دمياط','بورسعيد','الإسماعيلية','السويس','الشرقية','شمال سيناء','جنوب سيناء','بني سويف',
      'الفيوم','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','الوادي الجديد','مطروح'
    ]::text[]),
    'fee', base_fee
  )
)
where id = 'default' and delivery_zones = '[]'::jsonb;

-- The old public RPC has no governorate argument, so remove it to prevent delivery-fee bypass.
drop function if exists public.place_order(text,text,text,text,jsonb);

create function public.place_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_governorate text,
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
  v_governorate text := trim(coalesce(p_governorate, ''));
  v_line record;
  v_product public.products%rowtype;
  v_qty integer;
  v_color text;
  v_size text;
begin
  if length(trim(coalesce(p_customer_name, ''))) not between 2 and 120 then raise exception 'invalid_name'; end if;
  if length(trim(coalesce(p_phone, ''))) not between 7 and 30 then raise exception 'invalid_phone'; end if;
  if length(trim(coalesce(p_address, ''))) not between 5 and 500 then raise exception 'invalid_address'; end if;
  if length(v_governorate) not between 2 and 80 then raise exception 'invalid_governorate'; end if;
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

  select (zone.value->>'fee')::numeric, settings.free_shipping_threshold
    into v_base_delivery_fee, v_free_shipping_threshold
    from public.delivery_settings settings
    cross join lateral jsonb_array_elements(settings.delivery_zones) as zone(value)
    where settings.id = 'default'
      and (zone.value->'governorates') ? v_governorate
    limit 1;
  if not found then raise exception 'delivery_unavailable'; end if;

  if v_free_shipping_threshold is not null and v_subtotal >= v_free_shipping_threshold then
    v_delivery_fee := 0;
  else
    v_delivery_fee := v_base_delivery_fee;
  end if;

  insert into public.orders (id, customer_name, phone, governorate, address, notes, subtotal, delivery_fee, total)
  values (v_order_id, trim(p_customer_name), trim(p_phone), v_governorate, trim(p_address), left(coalesce(p_notes, ''), 1000), v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee);

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

revoke all on function public.place_order(text,text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,text,jsonb) to anon, authenticated;
