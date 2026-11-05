create table if not exists public.category_details (
  slug text primary key check (slug in ('macrame','curtains','home-decor')),
  name text not null unique check (char_length(btrim(name)) between 2 and 80),
  english text not null check (char_length(btrim(english)) between 2 and 60),
  description text not null check (char_length(btrim(description)) between 5 and 300),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.category_details (slug,name,english,description)
values
  ('macrame','مكرميات حائط','WALL MACRAMÉ','تفاصيل من خيوط طبيعية وعقد يدوية تحكي حكاية على حيطتك.'),
  ('curtains','ستائر','MACRAMÉ CURTAINS','ضوء هادي، خامات طبيعية، ومقاس متظبط مخصوص لشباكك.'),
  ('home-decor','ديكور منزلي','HOME DETAILS','تفاصيل صغيرة معمولة بإيدينا عشان تدي البيت روح دافية.')
on conflict (slug) do nothing;

alter table public.category_details enable row level security;
grant select on public.category_details to anon, authenticated;

drop policy if exists "Anyone can read category details" on public.category_details;
create policy "Anyone can read category details" on public.category_details
  for select to anon, authenticated using (true);

create or replace function public.update_store_category(p_slug text,p_name text,p_english text,p_description text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_name text;
begin
  if not coalesce(public.has_staff_role(array['owner','manager','products']),false) then
    raise exception 'not authorized';
  end if;

  select name into previous_name
  from public.category_details
  where slug = p_slug
  for update;

  if not found then
    raise exception 'category not found';
  end if;

  update public.products
  set category = p_name, updated_at = now()
  where category = previous_name and previous_name <> p_name;

  update public.category_details
  set name = p_name,
      english = p_english,
      description = p_description,
      updated_by = auth.uid(),
      updated_at = now()
  where slug = p_slug;

  return true;
end;
$$;

revoke all on function public.update_store_category(text,text,text,text) from public, anon;
grant execute on function public.update_store_category(text,text,text,text) to authenticated;
