-- Staff lifecycle (product audit — owner day-1 gap: no way to offboard staff).
-- set_staff_active lets an owner/manager deactivate a departed employee (their
-- login stops working — staff_restaurant_id() only matches is_active rows) or
-- reactivate them, without touching auth. Guards: can't change your own row,
-- can't deactivate the venue's last active owner.
create or replace function public.set_staff_active(p_staff uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.staff;
  v_target public.staff;
begin
  select * into v_actor from public.staff where auth_uid = auth.uid() and is_active limit 1;
  if v_actor.id is null or v_actor.role not in ('owner', 'manager') then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  select * into v_target from public.staff
    where id = p_staff and restaurant_id = v_actor.restaurant_id;
  if v_target.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_target.id = v_actor.id then
    raise exception 'cannot_change_self' using errcode = 'P0001';
  end if;
  -- Only an owner may deactivate another owner.
  if v_target.role = 'owner' and v_actor.role <> 'owner' then
    raise exception 'owner_only' using errcode = 'P0001';
  end if;
  -- Never leave the venue with zero active owners.
  if not p_active and v_target.role = 'owner' then
    if (select count(*) from public.staff
        where restaurant_id = v_actor.restaurant_id and role = 'owner' and is_active and id <> v_target.id) = 0 then
      raise exception 'last_owner' using errcode = 'P0001';
    end if;
  end if;
  update public.staff set is_active = p_active where id = p_staff;
end;
$$;

revoke execute on function public.set_staff_active(uuid, boolean) from public, anon;
grant execute on function public.set_staff_active(uuid, boolean) to authenticated;
