-- Advisor hardening + hot-path performance (2026-07-13).
--
-- Clears the unambiguously-safe Supabase security/performance advisor findings.
-- Deliberately NOT included here (they change effective access and need their
-- own review + prod sign-off): merging multiple_permissive_policies via
-- `TO authenticated`, revoking EXECUTE from `authenticated` on admin RPCs (the
-- admin portal calls them as an authenticated admin), and dropping the 38
-- "unused" indexes (several are too young to judge).
--
-- Everything below is either additive (indexes), a no-op-to-behaviour rewrite
-- (wrapping auth.*() in a scalar sub-select), a search_path pin, or an
-- anon-only revoke where anon has no legitimate reason to call the function.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. function_search_path_mutable — pin a fixed search_path on the two flagged
--    (non-SECURITY-DEFINER) helpers so a caller can't inject a malicious path.
--    `public` keeps their existing unqualified refs (e.g. the stock_level enum)
--    resolvable while making the path immutable.
-- ─────────────────────────────────────────────────────────────────────────────
alter function public.stock_level_of(numeric, numeric, boolean) set search_path = public;
alter function public.stock_level_rank(public.stock_level)      set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. auth_rls_initplan — wrap auth.uid() / staff_restaurant_id() in a scalar
--    sub-select so Postgres evaluates them ONCE per query instead of once per
--    row on these hot customer-path tables. Logic is otherwise identical.
--    ALTER POLICY preserves cmd + roles and rewrites only the expression (no
--    drop/recreate window where the row would be exposed).
-- ─────────────────────────────────────────────────────────────────────────────
alter policy "customer read own orders" on public.orders
  using (created_by = (select auth.uid()));

alter policy "customer read own order_items" on public.order_items
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.created_by = (select auth.uid())
  ));

alter policy "customer read own reviews" on public.reviews
  using (created_by = (select auth.uid()));

alter policy "customer read own waiter_calls" on public.waiter_calls
  using (created_by = (select auth.uid()));

alter policy "staff read own profile" on public.staff
  using ((auth_uid = (select auth.uid())) or (restaurant_id = (select public.staff_restaurant_id())));

alter policy "member deletes own cart line" on public.session_cart_lines
  using (exists (
    select 1 from public.session_participants sp
    where sp.id = session_cart_lines.participant_id and sp.auth_uid = (select auth.uid())
  ));

alter policy "member updates own cart line" on public.session_cart_lines
  using (exists (
    select 1 from public.session_participants sp
    where sp.id = session_cart_lines.participant_id and sp.auth_uid = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.session_participants sp
    where sp.id = session_cart_lines.participant_id and sp.auth_uid = (select auth.uid())
  ));

alter policy "member inserts own cart line" on public.session_cart_lines
  with check (
    (exists (
      select 1 from public.session_participants sp
      where sp.id = session_cart_lines.participant_id
        and sp.session_id = session_cart_lines.session_id
        and sp.auth_uid = (select auth.uid())
        and sp.left_at is null
    ))
    and (exists (
      select 1 from public.order_sessions os
      where os.id = session_cart_lines.session_id and os.status = 'open'
    ))
    and (exists (
      select 1 from public.items it
        join public.order_sessions os on os.id = session_cart_lines.session_id
      where it.id = session_cart_lines.item_id and it.restaurant_id = os.restaurant_id
    ))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. anon_security_definer_function_executable (partial, safe subset).
--    The admin RPCs gate internally on is_platform_admin(), but anon should not
--    even be able to invoke them — revoke anon EXECUTE. `authenticated` keeps it
--    (the admin portal calls these as an authenticated admin). orders_restock_on
--    _cancel is a trigger function and never needs a direct EXECUTE grant.
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.admin_leads()                       from anon;
revoke execute on function public.admin_reviews_moderation(text)      from anon;
revoke execute on function public.admin_venue_overview()              from anon;
-- Trigger function: still carries the default PUBLIC execute grant, so revoking
-- from anon/authenticated alone leaves it callable via PUBLIC — revoke PUBLIC.
revoke execute on function public.orders_restock_on_cancel()          from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. unindexed_foreign_keys — add a covering btree index on every FK column
--    flagged by the advisor. Cheap on this dataset; speeds FK joins + the
--    cascade/SET-NULL checks fired on delete. IF NOT EXISTS so re-runs are safe.
-- ─────────────────────────────────────────────────────────────────────────────
-- Hot customer/ordering path
create index if not exists order_items_item_idx              on public.order_items (item_id);
create index if not exists orders_session_id_idx             on public.orders (session_id);
create index if not exists orders_cash_session_id_idx        on public.orders (cash_session_id);
create index if not exists orders_created_by_staff_idx       on public.orders (created_by_staff);
create index if not exists session_cart_lines_item_idx       on public.session_cart_lines (item_id);
create index if not exists session_cart_lines_participant_idx on public.session_cart_lines (participant_id);
create index if not exists items_category_idx               on public.items (category_id);
create index if not exists categories_parent_id_idx         on public.categories (parent_id);
create index if not exists order_sessions_host_uid_idx      on public.order_sessions (host_uid);
create index if not exists waiter_calls_created_by_idx      on public.waiter_calls (created_by);
create index if not exists waiter_calls_acknowledged_by_idx on public.waiter_calls (acknowledged_by);
-- Menu / catalog tenant FKs
create index if not exists modifier_groups_restaurant_idx   on public.modifier_groups (restaurant_id);
create index if not exists modifiers_restaurant_idx         on public.modifiers (restaurant_id);
-- Inventory
create index if not exists item_ingredients_restaurant_idx  on public.item_ingredients (restaurant_id);
create index if not exists inventory_notifications_item_idx on public.notifications (inventory_item_id);
create index if not exists stock_movements_created_by_idx   on public.stock_movements (created_by);
-- POS / cash / fiscal
create index if not exists cash_movements_created_by_staff_idx on public.cash_movements (created_by_staff);
create index if not exists cash_movements_restaurant_idx    on public.cash_movements (restaurant_id);
create index if not exists cash_sessions_opened_by_idx      on public.cash_sessions (opened_by);
create index if not exists cash_sessions_closed_by_idx      on public.cash_sessions (closed_by);
create index if not exists payments_created_by_staff_idx    on public.payments (created_by_staff);
create index if not exists staff_shifts_cash_session_idx    on public.staff_shifts (cash_session_id);
create index if not exists order_discounts_order_item_idx   on public.order_discounts (order_item_id);
create index if not exists order_discounts_approved_by_idx  on public.order_discounts (approved_by_staff);
create index if not exists order_discounts_restaurant_idx   on public.order_discounts (restaurant_id);
create index if not exists refunds_cash_session_idx         on public.refunds (cash_session_id);
create index if not exists refunds_approved_by_staff_idx    on public.refunds (approved_by_staff);
create index if not exists refunds_created_by_staff_idx     on public.refunds (created_by_staff);
-- Reviews / AI / audit
create index if not exists reviews_moderated_by_idx         on public.reviews (moderated_by);
create index if not exists ai_extractions_requested_by_idx  on public.ai_extractions (requested_by);
create index if not exists platform_reviews_config_updated_by_idx on public.platform_reviews_config (updated_by);

commit;
