-- Optional customer reference images. The bucket stays private; staff get short-lived signed links.
alter table public.delivery_settings
  add column if not exists allow_reference_image boolean not null default false;

alter table public.orders
  add column if not exists reference_image_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('customer-references','customer-references',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create or replace function public.customer_reference_upload_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(select 1 from public.delivery_settings where id='default' and allow_reference_image);
$$;
revoke all on function public.customer_reference_upload_enabled() from public;
grant execute on function public.customer_reference_upload_enabled() to anon,authenticated;

drop policy if exists "Customers can upload order reference images" on storage.objects;
create policy "Customers can upload order reference images" on storage.objects
  for insert to anon,authenticated
  with check (
    bucket_id='customer-references'
    and name ~ '^references/[0-9a-fA-F-]{36}[.](jpg|png|webp)$'
    and (select public.customer_reference_upload_enabled())
  );

drop policy if exists "Staff can read customer reference images" on storage.objects;
create policy "Staff can read customer reference images" on storage.objects
  for select to authenticated
  using (bucket_id='customer-references' and (select public.has_staff_role(array['owner','manager','orders'])));

create or replace function public.place_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_governorate text,
  p_customer_email text,
  p_coupon_code text,
  p_notes text,
  p_reference_image_path text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  if p_reference_image_path is not null then
    if not public.customer_reference_upload_enabled()
      or p_reference_image_path !~ '^references/[0-9a-fA-F-]{36}[.](jpg|png|webp)$'
      or not exists(select 1 from storage.objects where bucket_id='customer-references' and name=p_reference_image_path) then
      raise exception 'reference_image_invalid';
    end if;
  end if;

  v_order_id:=public.place_order(
    p_customer_name,
    p_phone,
    p_address,
    p_governorate,
    p_customer_email,
    p_coupon_code,
    p_notes,
    p_items
  );

  if p_reference_image_path is not null then
    update public.orders set reference_image_path=p_reference_image_path where id=v_order_id;
  end if;
  return v_order_id;
end;
$$;
revoke all on function public.place_order(text,text,text,text,text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,text,text,text,text,jsonb) to anon,authenticated;

notify pgrst,'reload schema';
