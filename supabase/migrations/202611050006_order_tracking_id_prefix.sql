-- Allow a tracking link that lost its final UUID nibble to resolve safely.
-- A 35-character UUID prefix still has 124 bits of entropy; only unique matches are returned.
create or replace function public.track_order_by_prefix(p_order_id_prefix text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  if p_order_id_prefix !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{11}$' then
    return null;
  end if;

  select array_agg(matches.id)
    into v_ids
    from (
      select o.id
      from public.orders o
      where left(o.id::text, 35) = lower(p_order_id_prefix)
      limit 2
    ) as matches;

  if coalesce(array_length(v_ids, 1), 0) <> 1 then
    return null;
  end if;

  return public.track_order(v_ids[1]);
end;
$$;

revoke all on function public.track_order_by_prefix(text) from public;
grant execute on function public.track_order_by_prefix(text) to anon, authenticated;

notify pgrst, 'reload schema';
