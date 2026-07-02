-- ============================================================
-- Chehia local development seed
-- Demo venue: Café El Marsa (La Marsa) — matches the design canvas.
-- Second venue: Le Zink (Berges du Lac) — proves tenant isolation.
--
-- Local portal logins (password for all: chehia-demo):
--   owner@elmarsa.tn    (owner)
--   cuisine@elmarsa.tn  (kitchen)
--   owner@lezink.tn     (owner, other tenant)
-- ============================================================

-- ---------- auth users (local only) ----------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('11111111-1111-1111-1111-111111111101'::uuid, 'owner@elmarsa.tn'),
      ('11111111-1111-1111-1111-111111111102'::uuid, 'cuisine@elmarsa.tn'),
      ('11111111-1111-1111-1111-111111111103'::uuid, 'sana@elmarsa.tn'),
      ('22222222-2222-2222-2222-222222222201'::uuid, 'owner@lezink.tn')
    ) as t(uid, email)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.uid, 'authenticated', 'authenticated',
      u.email, crypt('chehia-demo', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), u.uid, u.uid::text,
      jsonb_build_object('sub', u.uid::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end;
$$;

-- ---------- restaurants ----------
insert into public.restaurants (id, slug, name, tagline_i18n, address, city, phone, plan, cover_url, opening_hours)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cafe-el-marsa', 'Café El Marsa',
   '{"fr":"Corniche, La Marsa","ar":"الكورنيش، المرسى","en":"Corniche, La Marsa"}',
   'Avenue de la Corniche', 'La Marsa', '+216 71 000 000', 'pro', null,
   '{"mon":"07:00-23:00","tue":"07:00-23:00","wed":"07:00-23:00","thu":"07:00-23:00","fri":"07:00-23:00","sat":"07:00-00:00","sun":"07:00-00:00"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'le-zink', 'Le Zink',
   '{"fr":"Berges du Lac 2","ar":"ضفاف البحيرة 2","en":"Berges du Lac 2"}',
   'Rue du Lac Léman', 'Tunis', '+216 71 111 111', 'starter', null, '{}');

-- ---------- staff ----------
insert into public.staff (restaurant_id, auth_uid, role, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111101', 'owner', 'Sana B.'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111102', 'kitchen', 'Chef Karim'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111103', 'manager', 'Sana Manager'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222201', 'owner', 'Mehdi Z.');

-- ---------- categories (Café El Marsa) ----------
insert into public.categories (id, restaurant_id, name_i18n, sort_order) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '{"fr":"Cafés","ar":"القهوة","en":"Coffee"}', 0),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   '{"fr":"Petit-déjeuner","ar":"الفطور","en":"Breakfast"}', 1),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
   '{"fr":"Jus & citronnades","ar":"عصائر","en":"Juices & lemonades"}', 2),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
   '{"fr":"Pâtisseries","ar":"حلويات","en":"Pastries"}', 3);

-- ---------- items ----------
insert into public.items (id, restaurant_id, category_id, name_i18n, description_i18n, price_millimes, is_available, is_popular, allergens, dietary_tags, sort_order) values
  -- Cafés
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '{"fr":"Express","ar":"اكسبرس","en":"Espresso"}',
   '{"fr":"Court, intense, torréfaction locale","ar":"قصير ومركّز، تحميص محلي","en":"Short, intense, locally roasted"}',
   2800, true, false, '{}', '{vegetarian,vegan}', 0),
  ('dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '{"fr":"Direct","ar":"دايركت","en":"Direct"}',
   '{"fr":"Café au lait à la tunisienne","ar":"قهوة بالحليب على الطريقة التونسية","en":"Tunisian-style latte"}',
   3800, true, false, '{milk}', '{vegetarian}', 1),
  ('dddddddd-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '{"fr":"Cappuccino","ar":"كابوتشينو","en":"Cappuccino"}',
   '{"fr":"Espresso double origine, lait vapeur, mousse fine. Servi bien chaud.","ar":"إسبريسو، حليب مبخّر، رغوة ناعمة","en":"Double-origin espresso, steamed milk, fine foam"}',
   5500, true, true, '{milk}', '{vegetarian}', 2),
  ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '{"fr":"Café turc","ar":"قهوة تركية","en":"Turkish coffee"}',
   '{"fr":"Moulu fin, servi avec eau de fleur","ar":"مطحونة ناعم، تقدَّم مع ماء الزهر","en":"Finely ground, served with orange blossom water"}',
   3500, true, false, '{}', '{vegetarian,vegan}', 3),
  ('dddddddd-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '{"fr":"Café glacé","ar":"قهوة مثلجة","en":"Iced coffee"}',
   '{"fr":"Espresso, lait frais, glace pilée","ar":"إسبريسو، حليب طازج، ثلج مجروش","en":"Espresso, fresh milk, crushed ice"}',
   6500, false, false, '{milk}', '{vegetarian}', 4),
  ('dddddddd-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '{"fr":"Thé à la menthe","ar":"شاي بالنعناع","en":"Mint tea"}',
   '{"fr":"Thé vert, menthe fraîche, pignons en option","ar":"شاي أخضر، نعناع طازج","en":"Green tea, fresh mint, optional pine nuts"}',
   3000, true, false, '{}', '{vegetarian,vegan}', 5),
  -- Petit-déjeuner
  ('dddddddd-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002',
   '{"fr":"Plateau petit-déjeuner tunisien","ar":"صينية فطور تونسي","en":"Tunisian breakfast tray"}',
   '{"fr":"Bsissa, œuf, fromage, olives, pain de campagne, confiture maison","ar":"بسيسة، بيض، جبن، زيتون، خبز ريفي","en":"Bsissa, egg, cheese, olives, country bread, homemade jam"}',
   16500, true, true, '{eggs,milk,gluten}', '{vegetarian}', 0),
  ('dddddddd-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002',
   '{"fr":"Ojja merguez","ar":"عجة مرقاز","en":"Ojja merguez"}',
   '{"fr":"Œufs, tomates, piments, merguez de bœuf, servi avec pain","ar":"بيض، طماطم، فلفل، مرقاز بقري","en":"Eggs, tomatoes, peppers, beef merguez, served with bread"}',
   14500, true, false, '{eggs,gluten}', '{spicy}', 1),
  ('dddddddd-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002',
   '{"fr":"Croissant beurre","ar":"كرواسون بالزبدة","en":"Butter croissant"}',
   '{"fr":"Pur beurre, cuit sur place chaque matin","ar":"زبدة صافية، يُخبز كل صباح","en":"All butter, baked in-house every morning"}',
   2500, true, false, '{gluten,milk}', '{vegetarian}', 2),
  -- Jus & citronnades
  ('dddddddd-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003',
   '{"fr":"Citronnade fraîche","ar":"عصير ليمون طازج","en":"Fresh lemonade"}',
   '{"fr":"Citrons pressés minute, menthe fraîche","ar":"ليمون معصور طازج، نعناع","en":"Freshly squeezed lemons, fresh mint"}',
   6000, true, true, '{}', '{vegetarian,vegan}', 0),
  ('dddddddd-0000-0000-0000-000000000022', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003',
   '{"fr":"Jus d''orange","ar":"عصير برتقال","en":"Orange juice"}',
   '{"fr":"Oranges maltaises de saison","ar":"برتقال مالطي موسمي","en":"Seasonal Maltese oranges"}',
   5500, true, false, '{}', '{vegetarian,vegan}', 1),
  ('dddddddd-0000-0000-0000-000000000023', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003',
   '{"fr":"Jus de fraise","ar":"عصير فراولة","en":"Strawberry juice"}',
   '{"fr":"Fraises de Korba, sans sucre ajouté","ar":"فراولة قربة، بدون سكر مضاف","en":"Korba strawberries, no added sugar"}',
   7000, true, false, '{}', '{vegetarian,vegan}', 2),
  -- Pâtisseries
  ('dddddddd-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000004',
   '{"fr":"Bambalouni","ar":"بمبلوني","en":"Bambalouni"}',
   '{"fr":"Beignet tunisien, sucre fin — servi chaud","ar":"دونات تونسي بالسكر — يقدم ساخناً","en":"Tunisian doughnut, fine sugar — served hot"}',
   3500, true, true, '{gluten}', '{vegetarian}', 0),
  ('dddddddd-0000-0000-0000-000000000032', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000004',
   '{"fr":"Makroudh","ar":"مقروض","en":"Makroudh"}',
   '{"fr":"Semoule, dattes, miel — recette de Kairouan","ar":"سميد، تمر، عسل — وصفة قيروانية","en":"Semolina, dates, honey — Kairouan recipe"}',
   3000, true, false, '{gluten}', '{vegetarian}', 1);

-- ---------- modifier groups & modifiers (Cappuccino) ----------
insert into public.modifier_groups (id, restaurant_id, item_id, name_i18n, min_select, max_select, sort_order) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000003',
   '{"fr":"Taille","ar":"الحجم","en":"Size"}', 1, 1, 0),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000003',
   '{"fr":"Sucre","ar":"السكر","en":"Sugar"}', 0, 1, 1),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000003',
   '{"fr":"Extras","ar":"إضافات","en":"Extras"}', 0, 3, 2);

insert into public.modifiers (id, restaurant_id, group_id, name_i18n, price_delta_millimes, sort_order) values
  ('ffffffff-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
   '{"fr":"S — inclus","ar":"صغير — مشمول","en":"S — included"}', 0, 0),
  ('ffffffff-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
   '{"fr":"M","ar":"وسط","en":"M"}', 1000, 1),
  ('ffffffff-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
   '{"fr":"L","ar":"كبير","en":"L"}', 1800, 2),
  ('ffffffff-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002',
   '{"fr":"Sans","ar":"بدون","en":"None"}', 0, 0),
  ('ffffffff-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002',
   '{"fr":"Léger","ar":"خفيف","en":"Light"}', 0, 1),
  ('ffffffff-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002',
   '{"fr":"Normal","ar":"عادي","en":"Regular"}', 0, 2),
  ('ffffffff-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002',
   '{"fr":"Extra","ar":"زيادة","en":"Extra"}', 0, 3),
  ('ffffffff-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000003',
   '{"fr":"Double shot","ar":"جرعة مضاعفة","en":"Double shot"}', 1200, 0),
  ('ffffffff-0000-0000-0000-000000000022', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000003',
   '{"fr":"Lait d''amande","ar":"حليب اللوز","en":"Almond milk"}', 1500, 1),
  ('ffffffff-0000-0000-0000-000000000023', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000003',
   '{"fr":"Cannelle","ar":"قرفة","en":"Cinnamon"}', 500, 2);

-- Citronnade: glace (ice) preference
insert into public.modifier_groups (id, restaurant_id, item_id, name_i18n, min_select, max_select, sort_order) values
  ('eeeeeeee-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000021',
   '{"fr":"Glace","ar":"الثلج","en":"Ice"}', 0, 1, 0);

insert into public.modifiers (id, restaurant_id, group_id, name_i18n, price_delta_millimes, sort_order) values
  ('ffffffff-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000011',
   '{"fr":"Normale","ar":"عادي","en":"Regular"}', 0, 0),
  ('ffffffff-0000-0000-0000-000000000032', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000011',
   '{"fr":"Peu de glace","ar":"ثلج قليل","en":"Light ice"}', 0, 1),
  ('ffffffff-0000-0000-0000-000000000033', 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000011',
   '{"fr":"Sans glace","ar":"بدون ثلج","en":"No ice"}', 0, 2);

-- ---------- tables (14, matching the floor plan) ----------
insert into public.tables (restaurant_id, label, zone, qr_token, sort_order)
select 'aaaaaaaa-0000-0000-0000-000000000001',
       lpad(n::text, 2, '0'),
       case when n <= 6 then 'Terrasse' when n <= 12 then 'Salle' else 'Bar' end,
       'demo-elmarsa-t' || lpad(n::text, 2, '0'),
       n
from generate_series(1, 14) as n;

-- Le Zink: a couple of tables + one category/item, for isolation tests
insert into public.tables (restaurant_id, label, zone, qr_token, sort_order)
select 'bbbbbbbb-0000-0000-0000-000000000002', lpad(n::text, 2, '0'), 'Salle', 'demo-lezink-t' || lpad(n::text, 2, '0'), n
from generate_series(1, 4) as n;

insert into public.categories (id, restaurant_id, name_i18n, sort_order) values
  ('cccccccc-0000-0000-0000-000000000099', 'bbbbbbbb-0000-0000-0000-000000000002',
   '{"fr":"Boissons","ar":"مشروبات","en":"Drinks"}', 0);

insert into public.items (restaurant_id, category_id, name_i18n, description_i18n, price_millimes, sort_order) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000099',
   '{"fr":"Express","ar":"اكسبرس","en":"Espresso"}', '{"fr":"Classique","ar":"كلاسيكي","en":"Classic"}', 3200, 0);

-- ---------- sample orders (for portal/analytics demo) ----------
do $$
declare
  rid uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  t3 uuid; t6 uuid; t7 uuid; t12 uuid;
  o1 uuid; o2 uuid; o3 uuid; o4 uuid;
  capp uuid := 'dddddddd-0000-0000-0000-000000000003';
  citron uuid := 'dddddddd-0000-0000-0000-000000000021';
  bamba uuid := 'dddddddd-0000-0000-0000-000000000031';
  ojja uuid := 'dddddddd-0000-0000-0000-000000000012';
  turc uuid := 'dddddddd-0000-0000-0000-000000000004';
begin
  select id into t3 from public.tables where restaurant_id = rid and label = '03';
  select id into t6 from public.tables where restaurant_id = rid and label = '06';
  select id into t7 from public.tables where restaurant_id = rid and label = '07';
  select id into t12 from public.tables where restaurant_id = rid and label = '12';

  -- New order on T03 (rings in the portal)
  insert into public.orders (restaurant_id, table_id, status, note, total_millimes, created_at)
  values (rid, t3, 'new', 'Sans coriandre', 20500, now() - interval '10 seconds')
  returning id into o1;
  insert into public.order_items (order_id, restaurant_id, item_id, name_snapshot, qty, unit_price_millimes, modifiers_snapshot, note) values
    (o1, rid, ojja, '{"fr":"Ojja merguez","ar":"عجة مرقاز","en":"Ojja merguez"}', 1, 14500, '[]', 'bien cuite'),
    (o1, rid, citron, '{"fr":"Citronnade fraîche","ar":"عصير ليمون طازج","en":"Fresh lemonade"}', 1, 6000, '[]', '');

  -- Preparing on T06
  insert into public.orders (restaurant_id, table_id, status, note, total_millimes, created_at, accepted_at)
  values (rid, t6, 'preparing', '', 27600, now() - interval '5 minutes', now() - interval '4 minutes 12 seconds')
  returning id into o2;
  insert into public.order_items (order_id, restaurant_id, item_id, name_snapshot, qty, unit_price_millimes, modifiers_snapshot, note) values
    (o2, rid, capp, '{"fr":"Cappuccino","ar":"كابوتشينو","en":"Cappuccino"}', 2,  7300,
      '[{"group":{"fr":"Taille","ar":"الحجم","en":"Size"},"choice":{"fr":"L","ar":"كبير","en":"L"},"delta":1800},{"group":{"fr":"Sucre","ar":"السكر","en":"Sugar"},"choice":{"fr":"Sans","ar":"بدون","en":"None"},"delta":0}]', ''),
    (o2, rid, citron, '{"fr":"Citronnade fraîche","ar":"عصير ليمون طازج","en":"Fresh lemonade"}', 1, 6000,
      '[{"group":{"fr":"Glace","ar":"الثلج","en":"Ice"},"choice":{"fr":"Peu de glace","ar":"ثلج قليل","en":"Light ice"},"delta":0}]', ''),
    (o2, rid, bamba, '{"fr":"Bambalouni","ar":"بمبلوني","en":"Bambalouni"}', 2, 3500, '[]', 'bien chauds');

  -- Ready on T12
  insert into public.orders (restaurant_id, table_id, status, note, total_millimes, created_at, accepted_at, ready_at)
  values (rid, t12, 'ready', '', 7000, now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '1 minute')
  returning id into o3;
  insert into public.order_items (order_id, restaurant_id, item_id, name_snapshot, qty, unit_price_millimes, modifiers_snapshot) values
    (o3, rid, turc, '{"fr":"Café turc","ar":"قهوة تركية","en":"Turkish coffee"}', 1, 3500, '[]'),
    (o3, rid, bamba, '{"fr":"Bambalouni","ar":"بمبلوني","en":"Bambalouni"}', 1, 3500, '[]');

  -- Served on T07
  insert into public.orders (restaurant_id, table_id, status, note, total_millimes, created_at, accepted_at, ready_at, served_at)
  values (rid, t7, 'served', '', 19800, now() - interval '25 minutes', now() - interval '24 minutes', now() - interval '19 minutes', now() - interval '18 minutes')
  returning id into o4;
  insert into public.order_items (order_id, restaurant_id, item_id, name_snapshot, qty, unit_price_millimes, modifiers_snapshot) values
    (o4, rid, capp, '{"fr":"Cappuccino","ar":"كابوتشينو","en":"Cappuccino"}', 2, 5500, '[]'),
    (o4, rid, bamba, '{"fr":"Bambalouni","ar":"بمبلوني","en":"Bambalouni"}', 1, 3500, '[]'),
    (o4, rid, citron, '{"fr":"Citronnade fraîche","ar":"عصير ليمون طازج","en":"Fresh lemonade"}', 1, 5300, '[]');

  -- Waiter call on T09
  insert into public.waiter_calls (restaurant_id, table_id, reason, status, created_at)
  select rid, id, 'bill', 'open', now() - interval '31 seconds'
  from public.tables where restaurant_id = rid and label = '09';

  -- Historical orders over the past 14 days for analytics
  insert into public.orders (restaurant_id, table_id, status, total_millimes, created_at, accepted_at, ready_at, served_at)
  select
    rid,
    t7,
    'served',
    (3000 + (random() * 30000))::int,
    d,
    d + interval '1 minute',
    d + interval '6 minutes',
    d + interval '8 minutes'
  from (
    select now() - (day || ' days')::interval - (h || ' hours')::interval - (m || ' minutes')::interval as d
    from generate_series(1, 14) day,
         generate_series(0, 13) h,
         (select (random() * 50)::int as m) m_
    where random() < (case
      when h in (0, 1, 10, 11) then 0.85   -- lunch + evening peaks (hours back from ~22h)
      when h in (2, 3, 8, 9) then 0.55
      else 0.3 end)
  ) gen;

  -- attach one line to each historical order so top-items has data
  insert into public.order_items (order_id, restaurant_id, item_id, name_snapshot, qty, unit_price_millimes, modifiers_snapshot)
  select o.id, rid,
    (array[capp, citron, bamba, ojja, turc])[1 + (random() * 4.99)::int],
    '{"fr":"—"}', 1 + (random() * 2)::int, 4000 + (random() * 8000)::int, '[]'
  from public.orders o
  where o.restaurant_id = rid and o.created_at < now() - interval '1 hour';

  update public.order_items oi set name_snapshot = i.name_i18n
  from public.items i where oi.item_id = i.id and oi.name_snapshot = '{"fr":"—"}';
end;
$$;

-- ---------- demo AI insights (what the nightly job would produce) ----------
insert into public.ai_insights (restaurant_id, generated_for, language, title, body, recommendation, action_label, metrics) values
  ('aaaaaaaa-0000-0000-0000-000000000001', current_date, 'fr',
   'Vos cappuccinos tirent les matinées',
   'Entre 8h et 10h, le cappuccino est dans 41% des commandes — mais 23% de ces clients ne prennent rien à manger.',
   'Formule « cappuccino + bambalouni » à 8,0 TND → panier +14% estimé',
   'Créer la promotion',
   '{"share_morning": 0.41, "no_food_rate": 0.23, "estimated_basket_lift": 0.14}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', current_date, 'fr',
   'Le jeudi soir décroche',
   'Votre pic 18h–20h chute de 35% le jeudi, seul jour sans affluence en terrasse.',
   'Tester une happy hour citronnade 17h–19h le jeudi',
   'Planifier',
   '{"thursday_drop": 0.35}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', current_date, 'fr',
   'Le café glacé part trop tôt',
   'Épuisé avant 15h, 3 jours sur 7 la semaine dernière — environ 26 TND/jour de ventes manquées.',
   'Augmenter la préparation du matin de ~30%',
   'Noté, à suivre',
   '{"stockout_days": 3, "missed_tnd_per_day": 26}');
