-- ============================================================
-- import_menu_draft: persist a REVIEWED menu draft (categories + items) in ONE
-- transaction. Called directly from the portal by an owner/manager after they
-- edit the extract-menu draft. SECURITY DEFINER + explicit staff-manage gate.
-- Appends to existing categories (matched by French name, case-insensitive) or
-- creates new ones; items always append after the category's current max item.
-- Idempotent per (restaurant, import_ref) via the ai_menu_imports guard.
-- ============================================================
create table if not exists public.ai_menu_imports (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  import_ref    text not null,
  created_at    timestamptz not null default now(),
  primary key (restaurant_id, import_ref)
);
alter table public.ai_menu_imports enable row level security;
create policy "staff read own ai_menu_imports" on public.ai_menu_imports
  for select using (restaurant_id = public.staff_restaurant_id());

create or replace function public.import_menu_draft(
  p_restaurant_id uuid,
  p_draft jsonb,
  p_import_ref text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role         public.staff_role;
  v_cat          jsonb;
  v_item         jsonb;
  v_cat_id       uuid;
  v_cat_sort     int;
  v_item_sort    int;
  v_cat_name_fr  text;
  v_cats_created int := 0;
  v_cats_reused  int := 0;
  v_items_added  int := 0;
begin
  -- Gate: caller must be an active owner/manager OF THIS venue.
  -- SECURITY DEFINER bypasses RLS, so this check is mandatory.
  select s.role into v_role
  from public.staff s
  where s.auth_uid = auth.uid() and s.restaurant_id = p_restaurant_id and s.is_active
  limit 1;
  if v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  -- Idempotency: a repeated import_ref is a no-op.
  if p_import_ref is not null then
    insert into public.ai_menu_imports (restaurant_id, import_ref)
    values (p_restaurant_id, p_import_ref)
    on conflict (restaurant_id, import_ref) do nothing;
    if not found then
      return jsonb_build_object('categories_created', 0, 'categories_reused', 0,
                               'items_added', 0, 'idempotent', true);
    end if;
  end if;

  if jsonb_typeof(p_draft->'categories') <> 'array' then
    raise exception 'bad_draft' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_draft->'categories') > 40 then
    raise exception 'too_many_categories' using errcode = 'P0001';
  end if;

  select coalesce(max(sort_order), 0) into v_cat_sort
  from public.categories where restaurant_id = p_restaurant_id;

  for v_cat in select * from jsonb_array_elements(p_draft->'categories')
  loop
    v_cat_name_fr := trim(coalesce(v_cat->'name_i18n'->>'fr', ''));

    v_cat_id := null;
    if v_cat_name_fr <> '' then
      select c.id into v_cat_id
      from public.categories c
      where c.restaurant_id = p_restaurant_id
        and lower(c.name_i18n->>'fr') = lower(v_cat_name_fr)
      limit 1;
    end if;

    if v_cat_id is null then
      v_cat_sort := v_cat_sort + 1;
      insert into public.categories (restaurant_id, name_i18n, sort_order, is_active)
      values (p_restaurant_id, coalesce(v_cat->'name_i18n', '{}'::jsonb), v_cat_sort, true)
      returning id into v_cat_id;
      v_cats_created := v_cats_created + 1;
    else
      v_cats_reused := v_cats_reused + 1;
    end if;

    select coalesce(max(sort_order), 0) into v_item_sort
    from public.items where category_id = v_cat_id;

    if jsonb_typeof(v_cat->'items') = 'array' then
      for v_item in select * from jsonb_array_elements(v_cat->'items')
      loop
        v_item_sort := v_item_sort + 1;
        insert into public.items (
          restaurant_id, category_id, name_i18n, description_i18n,
          price_millimes, is_available, is_popular,
          allergens, dietary_tags, sort_order
        ) values (
          p_restaurant_id, v_cat_id,
          coalesce(v_item->'name_i18n', '{}'::jsonb),
          coalesce(v_item->'description_i18n', '{}'::jsonb),
          greatest(coalesce((v_item->>'price_millimes')::int, 0), 0),
          true,
          coalesce((v_item->>'is_popular')::boolean, false),
          case when jsonb_typeof(v_item->'allergens') = 'array'
               then array(select jsonb_array_elements_text(v_item->'allergens'))
               else '{}'::text[] end,
          case when jsonb_typeof(v_item->'dietary_tags') = 'array'
               then array(select jsonb_array_elements_text(v_item->'dietary_tags'))
               else '{}'::text[] end,
          v_item_sort
        );
        v_items_added := v_items_added + 1;
      end loop;
    end if;
  end loop;

  return jsonb_build_object(
    'categories_created', v_cats_created,
    'categories_reused',  v_cats_reused,
    'items_added',        v_items_added
  );
end;
$$;

revoke execute on function public.import_menu_draft(uuid, jsonb, text) from public, anon;
grant execute on function public.import_menu_draft(uuid, jsonb, text) to authenticated;
