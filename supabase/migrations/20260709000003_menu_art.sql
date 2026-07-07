-- ============================================================
-- Default menu artwork: when an item/category has no uploaded photo, the
-- customer menu shows a tasteful, theme-aware illustration instead of an empty
-- placeholder. The illustration is auto-matched from the name, or the business
-- picks one; the chosen id is stored here (null = auto-match).
-- The style toggle (illustration / pattern / plain) lives in restaurants.appearance.
-- ============================================================
alter table public.items add column if not exists art text;
alter table public.categories add column if not exists art text;
