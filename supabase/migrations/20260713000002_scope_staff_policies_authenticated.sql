-- Scope staff/platform/manager/owner/admin RLS policies to the `authenticated`
-- role (2026-07-13). Clears the bulk of the multiple_permissive_policies advisor
-- (140 findings): today these policies target `public`, so the `anon`,
-- `authenticator`, `dashboard_user` and `supabase_privileged_role` roles all
-- evaluate them on every request even though a staff/platform check can never
-- pass without an authenticated staff/admin JWT.
--
-- Access-neutral: `public` already includes `authenticated`, so every real
-- staff/platform/manager/owner user keeps identical access; only non-authenticated
-- roles — which never satisfied these policies anyway — stop evaluating them.
-- Customer/member/"public read" policies are intentionally NOT touched (customers
-- sign in anonymously and must keep access; menu/reviews stay world-readable).

begin;

-- AI
alter policy "staff read own ai_extractions"     on public.ai_extractions     to authenticated;
alter policy "staff read ai_insights"            on public.ai_insights        to authenticated;
alter policy "staff read own ai_menu_imports"    on public.ai_menu_imports    to authenticated;
-- Cash / POS
alter policy "staff read cash_movements"         on public.cash_movements     to authenticated;
alter policy "staff read cash_sessions"          on public.cash_sessions      to authenticated;
alter policy "staff read order_discounts"        on public.order_discounts    to authenticated;
alter policy "staff read payments"               on public.payments           to authenticated;
alter policy "staff read refunds"                on public.refunds            to authenticated;
alter policy "staff read shifts"                 on public.staff_shifts       to authenticated;
-- Menu / catalog
alter policy "platform manage categories"        on public.categories         to authenticated;
alter policy "platform read all categories"      on public.categories         to authenticated;
alter policy "staff manage categories"           on public.categories         to authenticated;
alter policy "platform manage items"             on public.items              to authenticated;
alter policy "platform read all items"           on public.items              to authenticated;
alter policy "staff manage items"                on public.items              to authenticated;
alter policy "platform manage modifier_groups"   on public.modifier_groups    to authenticated;
alter policy "platform read all modifier_groups" on public.modifier_groups    to authenticated;
alter policy "staff manage modifier_groups"      on public.modifier_groups    to authenticated;
alter policy "platform manage modifiers"         on public.modifiers          to authenticated;
alter policy "platform read all modifiers"       on public.modifiers          to authenticated;
alter policy "staff manage modifiers"            on public.modifiers          to authenticated;
alter policy "staff manage tables"               on public.tables             to authenticated;
-- Inventory
alter policy "manager manages inventory_items"   on public.inventory_items    to authenticated;
alter policy "staff read inventory_items"        on public.inventory_items    to authenticated;
alter policy "manager manages item_ingredients"  on public.item_ingredients   to authenticated;
alter policy "staff read item_ingredients"       on public.item_ingredients   to authenticated;
alter policy "staff read stock_movements"        on public.stock_movements    to authenticated;
alter policy "staff read notifications"          on public.notifications      to authenticated;
alter policy "staff update notifications"        on public.notifications      to authenticated;
-- Orders / service
alter policy "platform read all order_items"     on public.order_items        to authenticated;
alter policy "staff read order_items"            on public.order_items        to authenticated;
alter policy "platform read all orders"          on public.orders             to authenticated;
alter policy "staff read orders"                 on public.orders             to authenticated;
alter policy "staff update orders"               on public.orders             to authenticated;
alter policy "staff manage waiter_calls"         on public.waiter_calls       to authenticated;
alter policy "staff insert events"               on public.events             to authenticated;
alter policy "staff read events"                 on public.events             to authenticated;
-- Restaurant / fiscal / staff
alter policy "platform read all restaurants"     on public.restaurants        to authenticated;
alter policy "platform update all restaurants"   on public.restaurants        to authenticated;
alter policy "staff read own restaurant"         on public.restaurants        to authenticated;
alter policy "staff update own restaurant"       on public.restaurants        to authenticated;
alter policy "manager manages fiscal"            on public.restaurant_fiscal  to authenticated;
alter policy "staff read fiscal"                 on public.restaurant_fiscal  to authenticated;
alter policy "owner manages staff"               on public.staff              to authenticated;
alter policy "platform read all staff"           on public.staff              to authenticated;
alter policy "staff read own profile"            on public.staff              to authenticated;
-- Reviews / leads / platform config
alter policy "platform manage reviews"           on public.reviews            to authenticated;
alter policy "platform read all reviews"         on public.reviews            to authenticated;
alter policy "staff hide venue reviews"          on public.reviews            to authenticated;
alter policy "staff read venue reviews"          on public.reviews            to authenticated;
alter policy "platform admins read leads"        on public.leads              to authenticated;
alter policy "platform admins update leads"      on public.leads              to authenticated;
alter policy "platform admins read roster"       on public.platform_admins    to authenticated;
alter policy "platform read reviews config"      on public.platform_reviews_config to authenticated;
alter policy "platform write reviews config"     on public.platform_reviews_config to authenticated;

commit;
