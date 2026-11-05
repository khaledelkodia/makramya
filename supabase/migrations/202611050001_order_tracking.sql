create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null check (status in ('new','confirmed','in_progress','shipped','completed','cancelled')),
  customer_note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_recent
  on public.order_status_history(order_id, created_at);

alter table public.order_status_history enable row level security;
grant select on public.order_status_history to authenticated;
drop policy if exists "Staff can read order status history" on public.order_status_history;
create policy "Staff can read order status history" on public.order_status_history
  for select to authenticated
  using ((select public.has_staff_role(array['owner','manager','orders'])));

-- Record a customer-safe timeline event whenever an order is created or its status changes.
create or replace function public.record_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_note text;
begin
  if tg_op = 'INSERT' then
    v_customer_note := 'استلمنا طلبك. هنراجع التفاصيل ونتواصل معاكي لتأكيده.';
  elsif new.status is distinct from old.status then
    v_customer_note := case new.status
      when 'confirmed' then 'تم تأكيد طلبك وهنبدأ تجهيزه.'
      when 'in_progress' then 'بدأنا تجهيز القطعة يدويًا.'
      when 'shipped' then 'طلبك اتشحن وفي الطريق ليكي.'
      when 'completed' then 'تم تسليم الطلب. نتمنى يعجبك!'
      when 'cancelled' then 'تم إلغاء الطلب.'
      else 'اتحدّثت حالة طلبك.'
    end;
  else
    return new;
  end if;

  insert into public.order_status_history(order_id, status, customer_note)
  values (new.id, new.status, v_customer_note);
  return new;
end;
$$;

revoke all on function public.record_order_status_event() from public, anon, authenticated;
drop trigger if exists record_order_status_event on public.orders;
create trigger record_order_status_event
  after insert or update of status on public.orders
  for each row execute function public.record_order_status_event();

-- Backfill one event for every existing order.
insert into public.order_status_history(order_id, status, customer_note, created_at)
select o.id, o.status,
  case o.status
    when 'new' then 'استلمنا طلبك. هنراجع التفاصيل ونتواصل معاكي لتأكيده.'
    when 'confirmed' then 'تم تأكيد طلبك وهنبدأ تجهيزه.'
    when 'in_progress' then 'بدأنا تجهيز القطعة يدويًا.'
    when 'shipped' then 'طلبك اتشحن وفي الطريق ليكي.'
    when 'completed' then 'تم تسليم الطلب. نتمنى يعجبك!'
    when 'cancelled' then 'تم إلغاء الطلب.'
    else 'استلمنا طلبك.'
  end,
  case when o.status = 'new' then o.created_at else o.updated_at end
from public.orders o
where not exists (select 1 from public.order_status_history h where h.order_id = o.id);

-- The random order UUID acts as the private tracking link; this function returns status only.
create or replace function public.track_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order jsonb;
begin
  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', h.status,
        'customer_note', h.customer_note,
        'created_at', h.created_at
      ) order by h.created_at)
      from public.order_status_history h where h.order_id = o.id
    ), '[]'::jsonb)
  ) into v_order
  from public.orders o
  where o.id = p_order_id;

  return v_order;
end;
$$;

revoke all on function public.track_order(uuid) from public;
grant execute on function public.track_order(uuid) to anon, authenticated;
