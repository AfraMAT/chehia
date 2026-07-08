-- ============================================================
-- Location-gated ordering (anti-abuse).
--
-- A venue pins its exact spot (latitude/longitude already exist from
-- discovery_and_geo) plus a geofence radius. Remote "browse" orders
-- (app.chehia.app / discovery) then require the customer to be within that
-- radius of the pin — so people can only order while physically at the venue.
--
-- Scanned-QR orders are unaffected: the QR is a per-table secret capability,
-- so scanning it already proves presence. Enforcement lives in the place-order
-- edge function (the sole customer write path); these columns are its config.
-- ============================================================

alter table public.restaurants
  add column if not exists geofence_radius_m int not null default 200
    check (geofence_radius_m between 20 and 5000),
  add column if not exists require_location boolean not null default true;

comment on column public.restaurants.geofence_radius_m is
  'Metres: how close a customer must be to the pin to place a browse-flow order.';
comment on column public.restaurants.require_location is
  'When true, browse-flow orders require the customer within geofence_radius_m of the pin (enforced in place-order). Ignored for scanned-QR orders and when no pin is set.';
