-- ============================================================
-- Menu customization: subcategories + per-venue appearance.
-- - categories gain a self-referential parent_id (one nesting level:
--   top-level categories → subcategories), plus optional image/icon for
--   image- and icon-based landing layouts.
-- - restaurants gain an `appearance` jsonb blob (color theme + layout
--   choices) read through resolveAppearance() in @chehia/shared.
-- - platform admins gain read+manage on the menu tables so the admin
--   portal can manage a venue's categories/items (they had none before).
-- ============================================================

-- ------------------------------------------------------------
-- Subcategories + category imagery
-- ------------------------------------------------------------
alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete cascade,
  add column if not exists image_url text,
  add column if not exists icon text;

create index if not exists categories_parent_idx
  on public.categories (restaurant_id, parent_id, sort_order);

-- Keep the hierarchy sane: a subcategory's parent must be in the SAME venue and
-- must itself be top-level (no 3rd level), and a category cannot be its own
-- parent. RLS `with check` can't compare the parent's tenant, so enforce here.
create or replace function public.enforce_category_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent public.categories;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'category_cannot_be_its_own_parent' using errcode = 'P0001';
  end if;
  select * into v_parent from public.categories where id = new.parent_id;
  if not found then
    raise exception 'parent_category_not_found' using errcode = 'P0001';
  end if;
  if v_parent.restaurant_id <> new.restaurant_id then
    raise exception 'parent_category_wrong_tenant' using errcode = 'P0001';
  end if;
  if v_parent.parent_id is not null then
    raise exception 'subcategories_cannot_nest' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists categories_enforce_parent on public.categories;
create trigger categories_enforce_parent
  before insert or update of parent_id, restaurant_id on public.categories
  for each row execute function public.enforce_category_parent();

-- ------------------------------------------------------------
-- Per-venue appearance (theme + layout). Always resolved client-side.
-- ------------------------------------------------------------
alter table public.restaurants
  add column if not exists appearance jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------
-- Platform-admin access to the menu tables (mirrors the existing
-- "platform … all restaurants" policies). Admins previously had NO policy
-- on these tables, so admin menu management would silently no-op.
-- ------------------------------------------------------------
create policy "platform read all categories" on public.categories
  for select using (public.is_platform_admin());
create policy "platform manage categories" on public.categories
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "platform read all items" on public.items
  for select using (public.is_platform_admin());
create policy "platform manage items" on public.items
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "platform read all modifier_groups" on public.modifier_groups
  for select using (public.is_platform_admin());
create policy "platform manage modifier_groups" on public.modifier_groups
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "platform read all modifiers" on public.modifiers
  for select using (public.is_platform_admin());
create policy "platform manage modifiers" on public.modifiers
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Platform admins manage any venue's images (category images, covers, item photos),
-- since they are not staff of the venue and so fail the staff-folder storage check.
create policy "platform manage item-photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'item-photos' and public.is_platform_admin())
  with check (bucket_id = 'item-photos' and public.is_platform_admin());

-- ------------------------------------------------------------
-- Extend import_menu_draft: a category may carry a `subcategories` array
-- ([{ name_i18n, items:[…] }]). Subcategories are always created fresh under
-- the (created or reused) parent. Flat drafts are unchanged (backward compatible).
-- ------------------------------------------------------------
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
  v_sub          jsonb;
  v_item         jsonb;
  v_cat_id       uuid;
  v_sub_id       uuid;
  v_cat_sort     int;
  v_sub_sort     int;
  v_item_sort    int;
  v_cat_name_fr  text;
  v_cats_created int := 0;
  v_cats_reused  int := 0;
  v_items_added  int := 0;
begin
  -- Gate: caller must be an active owner/manager OF THIS venue.
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
  from public.categories where restaurant_id = p_restaurant_id and parent_id is null;

  for v_cat in select * from jsonb_array_elements(p_draft->'categories')
  loop
    v_cat_name_fr := trim(coalesce(v_cat->'name_i18n'->>'fr', ''));

    v_cat_id := null;
    if v_cat_name_fr <> '' then
      select c.id into v_cat_id
      from public.categories c
      where c.restaurant_id = p_restaurant_id
        and c.parent_id is null
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

    -- Subcategories (optional): always created fresh under the parent.
    if jsonb_typeof(v_cat->'subcategories') = 'array' then
      v_sub_sort := 0;
      for v_sub in select * from jsonb_array_elements(v_cat->'subcategories')
      loop
        v_sub_sort := v_sub_sort + 1;
        insert into public.categories (restaurant_id, parent_id, name_i18n, sort_order, is_active)
        values (p_restaurant_id, v_cat_id, coalesce(v_sub->'name_i18n', '{}'::jsonb), v_sub_sort, true)
        returning id into v_sub_id;
        v_cats_created := v_cats_created + 1;

        if jsonb_typeof(v_sub->'items') = 'array' then
          v_item_sort := 0;
          for v_item in select * from jsonb_array_elements(v_sub->'items')
          loop
            v_item_sort := v_item_sort + 1;
            insert into public.items (
              restaurant_id, category_id, name_i18n, description_i18n,
              price_millimes, is_available, is_popular,
              allergens, dietary_tags, sort_order
            ) values (
              p_restaurant_id, v_sub_id,
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
