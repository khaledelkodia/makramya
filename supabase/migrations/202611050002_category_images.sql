create table if not exists public.category_images (
  slug text primary key check (slug in ('macrame','curtains','home-decor')),
  image_url text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.category_images enable row level security;
grant select on public.category_images to anon, authenticated;
grant insert, update, delete on public.category_images to authenticated;

drop policy if exists "Anyone can read category images" on public.category_images;
create policy "Anyone can read category images" on public.category_images
  for select to anon, authenticated using (true);

drop policy if exists "Product staff can manage category images" on public.category_images;
create policy "Product staff can manage category images" on public.category_images
  for all to authenticated
  using ((select public.has_staff_role(array['owner','manager','products'])))
  with check ((select public.has_staff_role(array['owner','manager','products'])));
