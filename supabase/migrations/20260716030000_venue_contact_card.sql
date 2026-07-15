-- Venue contact card (product audit — highest-ROI customer feature).
-- Lets a customer reach the venue: tap-to-call (existing phone), WhatsApp,
-- Instagram, and directions (from the existing lat/lng). Two new optional
-- fields; phone + coordinates already exist on restaurants.
alter table public.restaurants
  add column if not exists whatsapp text,
  add column if not exists instagram text;
