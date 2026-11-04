create extension if not exists pgcrypto;

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  style_key text not null default 'wall' check (style_key in ('wall','curtain','decor')),
  colors jsonb not null default '[]'::jsonb check (jsonb_typeof(colors) = 'array'),
  sizes text[] not null default '{}',
  inventory_count integer not null default 0 check (inventory_count >= 0),
  track_inventory boolean not null default false,
  badge text,
  status text not null default 'active' check (status in ('active','draft','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_name text not null,
  phone text not null,
  address text not null,
  notes text not null default '',
  status text not null default 'new' check (status in ('new','confirmed','in_progress','shipped','completed','cancelled')),
  subtotal numeric(10,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  total numeric(10,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  color text not null,
  size text not null,
  quantity integer not null check (quantity between 1 and 25),
  line_total numeric(10,2) not null check (line_total >= 0)
);

create index products_public_listing on public.products(status, sort_order, created_at desc);
create index orders_recent on public.orders(created_at desc);
create index order_items_order_id on public.order_items(order_id);

alter table public.admins enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Admins can read their own admin record" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Anyone can read active products" on public.products
  for select to anon, authenticated using (status = 'active' or (select public.is_admin()));
create policy "Admins can manage products" on public.products
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can read and update orders" on public.orders
  for select to authenticated using ((select public.is_admin()));
create policy "Admins can update orders" on public.orders
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can read order items" on public.order_items
  for select to authenticated using ((select public.is_admin()));
create policy "Admins can update order items" on public.order_items
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

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

  insert into public.orders (id, customer_name, phone, address, notes, subtotal, delivery_fee, total)
  values (v_order_id, trim(p_customer_name), trim(p_phone), trim(p_address), left(coalesce(p_notes, ''), 1000), v_subtotal, 0, v_subtotal);

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
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to anon;
grant select on public.admins to authenticated;
grant select on public.products to anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select, update on public.order_items to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "Product images are public" on storage.objects
  for select to anon, authenticated using (bucket_id = 'products');
create policy "Admins can upload product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'products' and (select public.is_admin()));
create policy "Admins can update product images" on storage.objects
  for update to authenticated using (bucket_id = 'products' and (select public.is_admin())) with check (bucket_id = 'products' and (select public.is_admin()));
create policy "Admins can delete product images" on storage.objects
  for delete to authenticated using (bucket_id = 'products' and (select public.is_admin()));

insert into public.products (slug, name, category, description, price, style_key, colors, sizes, badge, sort_order)
values
('sakina-wall-macrame', 'مكرمية حائط «سَكينة»', 'مكرميات حائط', 'قطعة متنفّذة يدوياً من خيوط القطن الطبيعي، بعقد دقيقة وخطوط هادية تدي حيطتك روحها.', 1850, 'wall', '[{"name":"طبيعي","hex":"#d4c3a4"},{"name":"رملي","hex":"#b69e7c"},{"name":"زيتي","hex":"#73755c"}]', array['40 × 60 سم','60 × 90 سم','مقاس مخصوص'], 'الأكثر طلباً', 1),
('zel-curtain', 'ستارة «ضِلّ»', 'ستائر', 'ستارة قطنية بخيوط مكرمية رقيقة، بتدخل النور بنعومة وتضيف للمكان لمسة هادية.', 3200, 'curtain', '[{"name":"عاجي","hex":"#eee6d7"},{"name":"كتان","hex":"#c7b69c"},{"name":"أبيض","hex":"#f5f1e8"}]', array['عرض 100 سم','عرض 150 سم','مقاس مخصوص'], 'حسب المقاس', 2),
('shams-macrame', 'مكرمية «شمس»', 'مكرميات حائط', 'تكوين دائري متقن بخيوط قطنية طبيعية، قطعة فن صغيرة بتعمل فرق كبير في أي ركن.', 1450, 'decor', '[{"name":"عسلي","hex":"#b78b5f"},{"name":"طبيعي","hex":"#d4c3a4"},{"name":"طوبي","hex":"#a96548"}]', array['قطر 35 سم','قطر 50 سم','مقاس مخصوص'], 'قطعة مميزة', 3),
('kheit-noor-divider', 'فاصل «خيط ونور»', 'ستائر', 'فاصل يدوي مميز للمساحات المفتوحة، معمول من خيوط قطن مختارة بعناية.', 4100, 'curtain', '[{"name":"عاجي","hex":"#eee6d7"},{"name":"رملي","hex":"#b69e7c"},{"name":"زيتي","hex":"#73755c"}]', array['عرض 90 سم','عرض 120 سم','مقاس مخصوص'], 'يتعمل مخصوص', 4),
('ghosn-plant-hanger', 'حامل نبات «غصن»', 'ديكور منزلي', 'حامل نبات يدوي من القطن الطبيعي يضيف لمسة خضرا ودفا للمكان.', 680, 'decor', '[{"name":"طبيعي","hex":"#d4c3a4"},{"name":"رملي","hex":"#b69e7c"},{"name":"طوبي","hex":"#a96548"}]', array['قصير','متوسط','طويل'], 'هدية حلوة', 5),
('mawg-wall-macrame', 'مكرمية «موج»', 'مكرميات حائط', 'عقد متدرجة مستوحاة من حركة الموج، قطعة مميزة مصنوعة على مهلك من أجود الخيوط.', 2200, 'wall', '[{"name":"طبيعي","hex":"#d4c3a4"},{"name":"أزرق بحري","hex":"#657678"},{"name":"رملي","hex":"#b69e7c"}]', array['50 × 70 سم','70 × 100 سم','مقاس مخصوص'], 'شغل إيدوي', 6),
('lemma-table-mat', 'مفرش «لَمّة»', 'ديكور منزلي', 'مفرش صغير بعقد مكرمية ناعمة، على الكومود أو طاولة القهوة.', 950, 'decor', '[{"name":"عاجي","hex":"#eee6d7"},{"name":"زيتي","hex":"#73755c"},{"name":"وردي ترابي","hex":"#c2927f"}]', array['قطر 25 سم','قطر 35 سم','مقاس مخصوص'], 'جديد', 7),
('sabah-curtain', 'ستارة «صباح»', 'ستائر', 'ستارة خفيفة بتفاصيل يدوية بسيطة، تتعمل بعرض وطول يناسب شباكك بالظبط.', 3650, 'curtain', '[{"name":"أبيض","hex":"#f5f1e8"},{"name":"عاجي","hex":"#eee6d7"},{"name":"طبيعي","hex":"#d4c3a4"}]', array['عرض 100 سم','عرض 150 سم','مقاس مخصوص'], 'حسب المقاس', 8)
on conflict (slug) do nothing;
