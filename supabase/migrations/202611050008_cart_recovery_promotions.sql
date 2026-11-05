-- Product markdowns, coupon codes, abandoned carts, and checkout support.
alter table public.products
  add column if not exists sale_price numeric(10,2);

alter table public.products
  drop constraint if exists products_sale_price_check;
alter table public.products
  add constraint products_sale_price_check
  check (sale_price is null or (sale_price > 0 and sale_price < price));

alter table public.orders
  add column if not exists discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  add column if not exists coupon_code text;

create table if not exists public.store_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  max_discount numeric(10,2) check (max_discount is null or max_discount > 0),
  minimum_subtotal numeric(10,2) not null default 0 check (minimum_subtotal >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint store_coupons_value_check check (discount_type <> 'percent' or discount_value <= 100),
  constraint store_coupons_dates_check check (ends_at is null or starts_at is null or ends_at > starts_at)
);

alter table public.store_coupons enable row level security;
drop policy if exists "Managers can manage store coupons" on public.store_coupons;
create policy "Managers can manage store coupons" on public.store_coupons
  for all to authenticated
  using ((select public.has_staff_role(array['owner','manager'])))
  with check ((select public.has_staff_role(array['owner','manager'])));
grant select, insert, update, delete on public.store_coupons to authenticated;

create table if not exists public.customer_carts (
  cart_key text primary key,
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null default '',
  customer_email text not null default '',
  phone text not null default '',
  address text not null default '',
  governorate text not null default '',
  contact_consent boolean not null default false,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  subtotal numeric(10,2) not null default 0 check (subtotal >= 0),
  status text not null default 'active' check (status in ('active','converted','closed')),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_carts_status_updated_at on public.customer_carts(status, updated_at desc);
create index if not exists customer_carts_customer_id on public.customer_carts(customer_id) where customer_id is not null;
alter table public.customer_carts enable row level security;
drop policy if exists "Staff can read customer carts" on public.customer_carts;
create policy "Staff can read customer carts" on public.customer_carts
  for select to authenticated
  using ((select public.has_staff_role(array['owner','manager','orders'])));
drop policy if exists "Staff can close customer carts" on public.customer_carts;
create policy "Staff can close customer carts" on public.customer_carts
  for update to authenticated
  using ((select public.has_staff_role(array['owner','manager','orders'])))
  with check ((select public.has_staff_role(array['owner','manager','orders'])));
grant select, update on public.customer_carts to authenticated;

create or replace function public.save_customer_cart(
  p_cart_key text,
  p_items jsonb,
  p_customer_name text default '',
  p_customer_email text default '',
  p_phone text default '',
  p_address text default '',
  p_governorate text default '',
  p_contact_consent boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := '';
  v_name text := '';
  v_phone text := '';
  v_address text := '';
  v_governorate text := '';
  v_subtotal numeric(10,2) := 0;
  v_items jsonb := '[]'::jsonb;
  v_line record;
  v_product public.products%rowtype;
  v_qty integer;
  v_color text;
  v_size text;
  v_price numeric(10,2);
begin
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'invalid_items';
  end if;
  if v_uid is not null then
    if p_cart_key is null or p_cart_key <> ('u:' || v_uid::text) then raise exception 'invalid_cart_key'; end if;
    if coalesce(p_contact_consent,false) then
      select lower(coalesce(u.email,'')) into v_email from auth.users u where u.id = v_uid;
    end if;
  else
    if p_cart_key !~ '^g:[0-9a-fA-F-]{36}$' or not coalesce(p_contact_consent,false) then
      raise exception 'contact_consent_required';
    end if;
    v_email := lower(trim(coalesce(p_customer_email,'')));
  end if;

  if coalesce(p_contact_consent,false) then
    v_name := left(trim(coalesce(p_customer_name,'')),120);
    v_phone := left(trim(coalesce(p_phone,'')),30);
    v_address := left(trim(coalesce(p_address,'')),500);
    v_governorate := left(trim(coalesce(p_governorate,'')),80);
    if length(v_name) < 2 or length(v_phone) < 7 or length(v_address) < 5 or length(v_email) not between 5 and 254 then
      raise exception 'invalid_contact_details';
    end if;
  end if;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_line.value->>'quantity')::integer;
    v_color := trim(coalesce(v_line.value->>'color',''));
    v_size := trim(coalesce(v_line.value->>'size',''));
    if v_qty not between 1 and 25 or length(v_color) not between 1 and 80 or length(v_size) not between 1 and 80 then raise exception 'invalid_item_options'; end if;
    select * into v_product from public.products where id = (v_line.value->>'product_id')::uuid and status = 'active';
    if not found then raise exception 'product_unavailable'; end if;
    if not exists (select 1 from jsonb_array_elements(v_product.colors) c where c->>'name' = v_color) then raise exception 'invalid_color'; end if;
    if not (v_size = any(v_product.sizes) or ('مقاس مخصوص' = any(v_product.sizes) and v_size ~ '^[0-9]{1,4} × [0-9]{1,4} سم$')) then raise exception 'invalid_size'; end if;
    v_price := coalesce(v_product.sale_price,v_product.price);
    v_subtotal := v_subtotal + v_price * v_qty;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id',v_product.id,'product_name',v_product.name,'image_url',v_product.image_url,
      'color',v_color,'size',v_size,'quantity',v_qty,'unit_price',v_price,'line_total',v_price*v_qty
    ));
  end loop;

  insert into public.customer_carts(cart_key,customer_id,customer_name,customer_email,phone,address,governorate,contact_consent,items,subtotal,status,order_id,updated_at)
  values(p_cart_key,v_uid,v_name,v_email,v_phone,v_address,v_governorate,coalesce(p_contact_consent,false),v_items,v_subtotal,'active',null,now())
  on conflict(cart_key) do update set customer_id=excluded.customer_id,customer_name=excluded.customer_name,customer_email=excluded.customer_email,
    phone=excluded.phone,address=excluded.address,governorate=excluded.governorate,contact_consent=excluded.contact_consent,
    items=excluded.items,subtotal=excluded.subtotal,status='active',order_id=null,updated_at=now();
end;
$$;
revoke all on function public.save_customer_cart(text,jsonb,text,text,text,text,text,boolean) from public;
grant execute on function public.save_customer_cart(text,jsonb,text,text,text,text,text,boolean) to anon, authenticated;

create or replace function public.revoke_customer_cart_contact(p_cart_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    update public.customer_carts set contact_consent=false,customer_name='',customer_email='',phone='',address='',governorate='',updated_at=now()
      where cart_key=p_cart_key and customer_id=(select auth.uid());
  elsif p_cart_key ~ '^g:[0-9a-fA-F-]{36}$' then
    update public.customer_carts set contact_consent=false,customer_name='',customer_email='',phone='',address='',governorate='',updated_at=now()
      where cart_key=p_cart_key;
  end if;
end;
$$;
revoke all on function public.revoke_customer_cart_contact(text) from public;
grant execute on function public.revoke_customer_cart_contact(text) to anon,authenticated;

create or replace function public.quote_coupon(p_code text, p_subtotal numeric)
returns table(valid boolean, discount_amount numeric, normalized_code text, message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon public.store_coupons%rowtype;
  v_code text := upper(trim(coalesce(p_code,'')));
  v_discount numeric(10,2) := 0;
begin
  select * into v_coupon from public.store_coupons c where c.code=v_code and c.is_active;
  if not found then return query select false,0::numeric,v_code,'الكوبون غير موجود أو غير فعال'; return; end if;
  if v_coupon.starts_at is not null and now() < v_coupon.starts_at then return query select false,0::numeric,v_code,'الكوبون لم يبدأ بعد'; return; end if;
  if v_coupon.ends_at is not null and now() >= v_coupon.ends_at then return query select false,0::numeric,v_code,'انتهت صلاحية الكوبون'; return; end if;
  if v_coupon.usage_limit is not null and v_coupon.uses_count >= v_coupon.usage_limit then return query select false,0::numeric,v_code,'تم استخدام الكوبون بالكامل'; return; end if;
  if coalesce(p_subtotal,0) < v_coupon.minimum_subtotal then return query select false,0::numeric,v_code,'قيمة السلة أقل من الحد الأدنى للكوبون'; return; end if;
  v_discount := case when v_coupon.discount_type='percent' then p_subtotal*v_coupon.discount_value/100 else v_coupon.discount_value end;
  if v_coupon.max_discount is not null then v_discount := least(v_discount,v_coupon.max_discount); end if;
  v_discount := least(greatest(v_discount,0),greatest(coalesce(p_subtotal,0),0));
  return query select true,round(v_discount,2),v_code,'الكوبون اتطبق بنجاح';
end;
$$;
revoke all on function public.quote_coupon(text,numeric) from public;
grant execute on function public.quote_coupon(text,numeric) to anon, authenticated;

-- Keep stock and delivery calculations authoritative in Postgres while charging sale prices.
create or replace function public.place_order(
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
  v_governorate text := trim(coalesce(p_governorate,''));
  v_line record;
  v_product public.products%rowtype;
  v_qty integer;
  v_color text;
  v_size text;
  v_price numeric(10,2);
begin
  if length(trim(coalesce(p_customer_name,''))) not between 2 and 120 then raise exception 'invalid_name'; end if;
  if length(trim(coalesce(p_phone,''))) not between 7 and 30 then raise exception 'invalid_phone'; end if;
  if length(trim(coalesce(p_address,''))) not between 5 and 500 then raise exception 'invalid_address'; end if;
  if length(v_governorate) not between 2 and 80 then raise exception 'invalid_governorate'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'invalid_items'; end if;
  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_line.value->>'quantity')::integer;
    v_color := trim(coalesce(v_line.value->>'color',''));
    v_size := trim(coalesce(v_line.value->>'size',''));
    if v_qty not between 1 and 25 or length(v_color) not between 1 and 80 or length(v_size) not between 1 and 80 then raise exception 'invalid_item_options'; end if;
    select * into v_product from public.products where id=(v_line.value->>'product_id')::uuid and status='active' for update;
    if not found then raise exception 'product_unavailable'; end if;
    if not exists(select 1 from jsonb_array_elements(v_product.colors) c where c->>'name'=v_color) then raise exception 'invalid_color'; end if;
    if not (v_size=any(v_product.sizes) or ('مقاس مخصوص'=any(v_product.sizes) and v_size ~ '^[0-9]{1,4} × [0-9]{1,4} سم$')) then raise exception 'invalid_size'; end if;
    if v_product.track_inventory then
      if v_qty>v_product.inventory_count then raise exception 'insufficient_stock'; end if;
      update public.products set inventory_count=inventory_count-v_qty,updated_at=now() where id=v_product.id;
    end if;
    v_price := coalesce(v_product.sale_price,v_product.price);
    v_subtotal := v_subtotal + v_price*v_qty;
  end loop;
  select (zone.value->>'fee')::numeric,settings.free_shipping_threshold into v_base_delivery_fee,v_free_shipping_threshold
    from public.delivery_settings settings cross join lateral jsonb_array_elements(settings.delivery_zones) as zone(value)
    where settings.id='default' and (zone.value->'governorates') ? v_governorate limit 1;
  if not found then raise exception 'delivery_unavailable'; end if;
  if v_free_shipping_threshold is not null and v_subtotal>=v_free_shipping_threshold then v_delivery_fee:=0; else v_delivery_fee:=v_base_delivery_fee; end if;
  insert into public.orders(id,customer_name,phone,governorate,address,notes,subtotal,delivery_fee,total)
  values(v_order_id,trim(p_customer_name),trim(p_phone),v_governorate,trim(p_address),left(coalesce(p_notes,''),1000),v_subtotal,v_delivery_fee,v_subtotal+v_delivery_fee);
  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_line.value->>'quantity')::integer; v_color:=trim(v_line.value->>'color'); v_size:=trim(v_line.value->>'size');
    select * into v_product from public.products where id=(v_line.value->>'product_id')::uuid and status='active';
    v_price:=coalesce(v_product.sale_price,v_product.price);
    insert into public.order_items(order_id,product_id,product_name,unit_price,color,size,quantity,line_total)
    values(v_order_id,v_product.id,v_product.name,v_price,v_color,v_size,v_qty,v_price*v_qty);
  end loop;
  return v_order_id;
end;
$$;
revoke all on function public.place_order(text,text,text,text,text,jsonb) from public;
revoke all on function public.place_order(text,text,text,text,text,jsonb) from anon,authenticated;

-- A single checkout RPC revalidates coupons under a row lock and consumes a use atomically.
drop function if exists public.place_order(text,text,text,text,text,text,jsonb);
create function public.place_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_governorate text,
  p_customer_email text,
  p_coupon_code text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_customer_email,'')));
  v_code text := upper(trim(coalesce(p_coupon_code,'')));
  v_order_id uuid;
  v_customer_id uuid;
  v_user_email text;
  v_subtotal numeric(10,2);
  v_discount numeric(10,2) := 0;
  v_coupon public.store_coupons%rowtype;
begin
  if length(v_email) not between 5 and 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'invalid_email'; end if;
  if auth.uid() is not null then
    select lower(u.email) into v_user_email from auth.users u where u.id=(select auth.uid()) and u.email_confirmed_at is not null;
    if v_user_email=v_email then v_customer_id:=(select auth.uid()); end if;
  end if;
  v_order_id:=public.place_order(p_customer_name,p_phone,p_address,p_governorate,p_notes,p_items);
  select subtotal into v_subtotal from public.orders where id=v_order_id;
  if v_code<>'' then
    select * into v_coupon from public.store_coupons c where c.code=v_code for update;
    if not found or not v_coupon.is_active then raise exception 'coupon_invalid'; end if;
    if v_coupon.starts_at is not null and now()<v_coupon.starts_at then raise exception 'coupon_not_started'; end if;
    if v_coupon.ends_at is not null and now()>=v_coupon.ends_at then raise exception 'coupon_expired'; end if;
    if v_coupon.usage_limit is not null and v_coupon.uses_count>=v_coupon.usage_limit then raise exception 'coupon_exhausted'; end if;
    if v_subtotal<v_coupon.minimum_subtotal then raise exception 'coupon_minimum_not_met'; end if;
    v_discount:=case when v_coupon.discount_type='percent' then v_subtotal*v_coupon.discount_value/100 else v_coupon.discount_value end;
    if v_coupon.max_discount is not null then v_discount:=least(v_discount,v_coupon.max_discount); end if;
    v_discount:=least(greatest(round(v_discount,2),0),v_subtotal);
    update public.store_coupons set uses_count=uses_count+1 where id=v_coupon.id;
  end if;
  update public.orders set customer_email=v_email,customer_id=v_customer_id,coupon_code=nullif(v_code,''),discount_amount=v_discount,total=subtotal+delivery_fee-v_discount where id=v_order_id;
  update public.customer_carts set status='converted',order_id=v_order_id,updated_at=now()
    where status='active' and ((v_customer_id is not null and customer_id=v_customer_id) or (contact_consent and customer_email=v_email));
  return v_order_id;
end;
$$;
revoke all on function public.place_order(text,text,text,text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,text,text,text,jsonb) to anon,authenticated;

notify pgrst,'reload schema';
