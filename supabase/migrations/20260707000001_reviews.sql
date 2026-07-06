-- ============================================================
-- Customer ratings & reviews.
--   * One `reviews` table: item_id NULL  = the visit/venue rating
--     (captured as a 😍/🙂/😐 face → 5/4/2 stars); item_id SET = a
--     dish rating (1–5 stars). Both tied to a served order + the
--     anonymous customer who placed it.
--   * Reviews start `pending`; a platform admin approves them. Only
--     `approved` reviews are ever public and only they count toward
--     the denormalised averages on restaurants/items.
--   * Identity is anonymous ("Client") with an optional first name.
-- ============================================================

create type public.review_status as enum ('pending', 'approved', 'rejected', 'hidden');

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  -- NULL => this row is the overall visit/venue rating; else a dish rating.
  item_id uuid references public.items(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  -- Only set on venue rows: which face the customer tapped.
  sentiment text check (sentiment in ('love', 'good', 'meh')),
  comment text not null default '' check (char_length(comment) <= 600),
  -- Optional first name; '' renders as "Client".
  customer_name text not null default '' check (char_length(customer_name) <= 40),
  status public.review_status not null default 'pending',
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  client_ref uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Stable key so "one venue review + one review per dish per order"
  -- is a single unique constraint (NULL item_id folds to the zero uuid).
  item_key uuid generated always as (coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored
);

create unique index reviews_one_per_target on public.reviews (order_id, item_key);
create index reviews_restaurant_idx on public.reviews (restaurant_id, status, created_at desc);
create index reviews_item_idx on public.reviews (item_id, status, created_at desc) where item_id is not null;
create index reviews_venue_public_idx on public.reviews (restaurant_id, created_at desc) where item_id is null and status = 'approved';
create index reviews_created_by_idx on public.reviews (created_by, order_id);

-- ------------------------------------------------------------
-- Denormalised aggregates (public read via items/restaurants).
-- ------------------------------------------------------------
alter table public.restaurants
  add column if not exists rating_avg numeric(3, 2),
  add column if not exists rating_count int not null default 0,
  add column if not exists reviews_enabled boolean not null default true;

alter table public.items
  add column if not exists rating_avg numeric(3, 2),
  add column if not exists rating_count int not null default 0;

-- Recompute a venue's aggregate from its APPROVED visit rows (item_id is null).
create or replace function public.recompute_restaurant_rating(p_restaurant_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.restaurants r set
    rating_avg = agg.avg,
    rating_count = agg.cnt
  from (
    select avg(rating)::numeric(3, 2) as avg, count(*)::int as cnt
    from public.reviews
    where restaurant_id = p_restaurant_id and item_id is null and status = 'approved'
  ) agg
  where r.id = p_restaurant_id;
$$;

-- Recompute a dish's aggregate from its APPROVED rows.
create or replace function public.recompute_item_rating(p_item_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.items i set
    rating_avg = agg.avg,
    rating_count = agg.cnt
  from (
    select avg(rating)::numeric(3, 2) as avg, count(*)::int as cnt
    from public.reviews
    where item_id = p_item_id and status = 'approved'
  ) agg
  where i.id = p_item_id;
$$;

create or replace function public.reviews_maintain_aggregates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recompute_restaurant_rating(new.restaurant_id);
    if new.item_id is not null then perform public.recompute_item_rating(new.item_id); end if;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    if old.restaurant_id is distinct from coalesce(new.restaurant_id, old.restaurant_id) or tg_op = 'DELETE' then
      perform public.recompute_restaurant_rating(old.restaurant_id);
    end if;
    if old.item_id is not null then perform public.recompute_item_rating(old.item_id); end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger reviews_aggregate_sync
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_maintain_aggregates();

-- Stamp moderation + updated_at on status changes.
create or replace function public.reviews_stamp_moderation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  if new.status is distinct from old.status then
    new.moderated_at = now();
    new.moderated_by = auth.uid();
  end if;
  return new;
end;
$$;

create trigger reviews_stamp before update on public.reviews
  for each row execute function public.reviews_stamp_moderation();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.reviews enable row level security;

-- Anyone may read APPROVED reviews (the public feed).
create policy "public read approved reviews" on public.reviews
  for select using (status = 'approved');

-- A customer may read their own reviews (any status) to see what they left.
create policy "customer read own reviews" on public.reviews
  for select using (created_by = auth.uid());

-- Staff read every review for their own venue (all statuses).
create policy "staff read venue reviews" on public.reviews
  for select using (restaurant_id = public.staff_restaurant_id());

-- Owners/managers may hide a review on their own venue (business recourse).
create policy "staff hide venue reviews" on public.reviews
  for update using (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner', 'manager']::public.staff_role[])
  ) with check (restaurant_id = public.staff_restaurant_id());

-- Platform admins moderate everything.
create policy "platform read all reviews" on public.reviews
  for select using (public.is_platform_admin());
create policy "platform manage reviews" on public.reviews
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Inserts happen only through submit-review (service role → bypasses RLS).

-- ------------------------------------------------------------
-- Global platform configuration (singleton).
-- ------------------------------------------------------------
create table public.platform_reviews_config (
  id boolean primary key default true check (id),
  reviews_enabled boolean not null default true,
  moderation_mode text not null default 'manual' check (moderation_mode in ('manual', 'auto', 'disabled')),
  allow_comments boolean not null default true,
  min_comment_len int not null default 0,
  max_comment_len int not null default 600,
  cooldown_hours int not null default 0,
  review_window_days int not null default 30,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_reviews_config (id) values (true) on conflict do nothing;

alter table public.platform_reviews_config enable row level security;

create policy "platform read reviews config" on public.platform_reviews_config
  for select using (public.is_platform_admin());
create policy "platform write reviews config" on public.platform_reviews_config
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ------------------------------------------------------------
-- Atomic review submission. SECURITY DEFINER; the submit-review edge
-- function validates the order (served, owned, in-window) and the
-- config, then calls this with the resolved status. Idempotent: a
-- resend cannot duplicate rows (unique per order+item; on conflict
-- keeps the first).
-- ------------------------------------------------------------
create or replace function public.place_review_tx(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_created_by uuid,
  p_customer_name text,
  p_status public.review_status,
  p_client_ref uuid,
  p_venue jsonb,   -- {"rating":5,"sentiment":"love","comment":"..."} or null
  p_items jsonb    -- [{"item_id":"...","rating":4,"comment":"..."}] or []
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(coalesce(p_customer_name, ''), 40);
  v_inserted int := 0;
  v_batch int := 0;
begin
  if p_venue is not null and p_venue ? 'rating' then
    insert into public.reviews (
      restaurant_id, order_id, item_id, created_by, rating, sentiment,
      comment, customer_name, status, client_ref
    ) values (
      p_restaurant_id, p_order_id, null, p_created_by,
      (p_venue->>'rating')::int, p_venue->>'sentiment',
      left(coalesce(p_venue->>'comment', ''), 600), v_name, p_status, p_client_ref
    ) on conflict (order_id, item_key) do nothing;
    if found then v_inserted := v_inserted + 1; end if;
  end if;

  insert into public.reviews (
    restaurant_id, order_id, item_id, created_by, rating,
    comment, customer_name, status, client_ref
  )
  select
    p_restaurant_id, p_order_id, (line->>'item_id')::uuid, p_created_by,
    (line->>'rating')::int, left(coalesce(line->>'comment', ''), 600),
    v_name, p_status, p_client_ref
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as line
  where (line->>'rating') is not null
  on conflict (order_id, item_key) do nothing;

  get diagnostics v_batch = row_count;
  v_inserted := v_inserted + v_batch;

  return jsonb_build_object('inserted', v_inserted, 'status', p_status);
end;
$$;

revoke execute on function public.place_review_tx from public, anon, authenticated;

-- ------------------------------------------------------------
-- Public read RPCs (SECURITY DEFINER — reviews table is not
-- directly public-readable beyond the approved policy; these shape
-- exactly what the customer app needs and hide internal columns).
-- ------------------------------------------------------------

-- Venue rating summary for discovery cards + venue home.
create or replace function public.venue_rating_summary(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select id, rating_avg, rating_count from public.restaurants
    where slug = p_slug and is_active
  ),
  dist as (
    select rating, count(*)::int as n
    from public.reviews rv
    join r on r.id = rv.restaurant_id
    where rv.item_id is null and rv.status = 'approved'
    group by rating
  )
  select jsonb_build_object(
    'rating_avg', (select rating_avg from r),
    'rating_count', coalesce((select rating_count from r), 0),
    'distribution', coalesce((select jsonb_object_agg(rating::text, n) from dist), '{}'::jsonb)
  );
$$;

revoke execute on function public.venue_rating_summary(text) from public;
grant execute on function public.venue_rating_summary(text) to anon, authenticated;

-- Recent approved reviews for one dish (item sheet). Also returns the
-- item's aggregate so the sheet needs a single round-trip.
create or replace function public.item_reviews(p_item_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'rating_avg', (select rating_avg from public.items where id = p_item_id),
    'rating_count', coalesce((select rating_count from public.items where id = p_item_id), 0),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rating', rating,
        'comment', comment,
        'name', nullif(customer_name, ''),
        'created_at', created_at
      ) order by created_at desc)
      from (
        select rating, comment, customer_name, created_at
        from public.reviews
        where item_id = p_item_id and status = 'approved'
        order by created_at desc
        limit 20
      ) recent
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.item_reviews(uuid) from public;
grant execute on function public.item_reviews(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Business dashboard RPC. SECURITY INVOKER: the staff-read RLS
-- policies scope the caller to their own venue.
-- ------------------------------------------------------------
create or replace function public.ratings_summary(p_restaurant_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with venue as (
    select rating, comment, customer_name, created_at, status
    from public.reviews
    where restaurant_id = p_restaurant_id and item_id is null
  ),
  approved as (select * from venue where status = 'approved'),
  dist as (
    select g.rating, coalesce(count(a.rating), 0)::int as n
    from generate_series(1, 5) as g(rating)
    left join approved a on a.rating = g.rating
    group by g.rating
  ),
  per_item as (
    select i.id, i.name_i18n, i.rating_avg, i.rating_count
    from public.items i
    where i.restaurant_id = p_restaurant_id and i.rating_count > 0
    order by i.rating_avg desc nulls last, i.rating_count desc
    limit 50
  ),
  recent as (
    select id, rating, sentiment, comment, customer_name, created_at, status, item_id
    from public.reviews
    where restaurant_id = p_restaurant_id
    order by created_at desc
    limit 40
  )
  select jsonb_build_object(
    'rating_avg', (select avg(rating)::numeric(3,2) from approved),
    'rating_count', (select count(*) from approved),
    'pending_count', (select count(*) from venue where status = 'pending'),
    'distribution', coalesce((select jsonb_agg(jsonb_build_object('rating', rating, 'n', n) order by rating desc) from dist), '[]'::jsonb),
    'per_item', coalesce((select jsonb_agg(jsonb_build_object(
        'item_id', id, 'name', name_i18n, 'rating_avg', rating_avg, 'rating_count', rating_count)) from per_item), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'rating', rating, 'sentiment', sentiment, 'comment', comment,
        'name', nullif(customer_name, ''), 'created_at', created_at,
        'status', status, 'item_id', item_id) order by created_at desc) from recent), '[]'::jsonb)
  );
$$;

-- ------------------------------------------------------------
-- Admin moderation RPC. SECURITY DEFINER, gated on is_platform_admin().
-- ------------------------------------------------------------
create or replace function public.admin_reviews_moderation(p_status text default null)
returns table (
  id uuid,
  restaurant_id uuid,
  restaurant_name text,
  order_number text,
  item_name jsonb,
  rating int,
  sentiment text,
  comment text,
  customer_name text,
  status public.review_status,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rv.id, rv.restaurant_id, r.name, o.order_number,
    i.name_i18n, rv.rating, rv.sentiment, rv.comment, rv.customer_name,
    rv.status, rv.created_at
  from public.reviews rv
  join public.restaurants r on r.id = rv.restaurant_id
  join public.orders o on o.id = rv.order_id
  left join public.items i on i.id = rv.item_id
  where public.is_platform_admin()
    and (p_status is null or rv.status = p_status::public.review_status)
  order by
    case when rv.status = 'pending' then 0 else 1 end,
    rv.created_at desc
  limit 500;
$$;

revoke execute on function public.admin_reviews_moderation(text) from public;
grant execute on function public.admin_reviews_moderation(text) to authenticated;
