# The Tunisia QR-Ordering Playbook: Build-Ready Product Spec + Market Strategy

## TL;DR
- **Build a native-app-first, order-only QR ordering platform on Expo (React Native) + Next.js + Supabase, hosted on Vercel + Supabase's free/Pro tiers — total infra cost near $0 to launch and roughly $25–70/month across the first 10–50 restaurants.** The single biggest differentiator versus every existing Tunisian competitor (Scanny, Digital Menu TN, MAGH-QR, DigiResto) is a genuinely beautiful native customer app plus an AI insights layer — none of the incumbents ship a native app; all are web/PWA only.
- **The market timing is unusually good: as of 1 July 2026, digital cash registers are legally mandatory for all Tunisian restaurant/café companies (personnes morales), with administrative fines up to 50,000 TND.** This forces owners to digitize now, opening the door for a modern ordering layer. Internet penetration is 84.9% and Android is ~85% of the mobile OS market — so design Android-first, with Arabic (RTL), French, and English from day one.
- **Recommended go-to-market: price at ~59–99 TND/month per location with a free trial and free white-glove onboarding (menu setup + QR printing done for the owner), land the first 10–20 venues in greater Tunis (La Marsa, Berges du Lac 1/2, Sidi Bou Saïd) via direct founder-led sales, and defer online payment (Flouci/D17/Konnect/e-DINAR) to Phase 3 after clients are onboarded.** MVP is deliberately order-only: customers still pay the cashier/server.

---

## Key Findings

### Market
- **Connectivity:** DataReportal's *Digital 2025: Tunisia* report states "there were 10.5 million individuals using the internet in Tunisia at the start of 2025, when online penetration stood at 84.9 percent" — up 715,000 (+7.3%) year-on-year; population 12.3M with 71.1% urban. A separate 2025 study cited by Xinhua put internet access at 84.3%.
- **Mobile OS split** (StatCounter GlobalStats, *Mobile Operating System Market Share Tunisia*, March 2026): **Android 84.66%, iOS 15.25%.** This is decisive — the product must be Android-first and tested on mid/entry-range Android (Samsung A-series, Redmi, Tecno) with robust poor-connection handling.
- **Restaurant/café universe** is large and heavily informal. Per EspaceManager reporting a national café-chamber official: "Le nombre d'établissements organisés est de 20.000 cafés, tandis qu'il y aurait 15.000 à 20.000 cafés ouverts anarchiquement" (20,000 organized cafés plus an estimated 15,000–20,000 informal ones). Sadri Ben Azouz, VP of the Chambre nationale des propriétaires de cafés classe A, has referenced "les 120.000 employés du secteur" (120,000 sector employees). Per Ilboursa, "La consommation des Tunisiens se fait à 80% hors domicile et 20% en foyer" (80% of coffee consumption is out-of-home). Consumer spending per capita in hospitality/restaurants was ~US$148.70 in 2024.
- **Regulatory catalyst:** Per La Presse (via allAfrica, 30 June 2026), citing the arrêté of the Minister of Finance dated 14 October 2025 (applying décret gouvernemental n°1126 of 2019): "À partir du 1er juillet 2026, l'obligation sera étendue à toutes les autres entreprises (personnes morales) proposant des aliments ou des boissons préparés ou prêts à consommer sur place." Phase 1 (1 November 2025) already covered classified tourist restaurants, tea salons, and 2nd/3rd-category cafés; physical persons under the régime réel follow 1 July 2027 and the rest 1 July 2028. Mohamed Nakach, director at the DGI, said on Radio Nationale (La Presse, 1 July 2026) that non-compliance exposes operators to "des sanctions financières rigoureuses, avec des amendes administratives pouvant atteindre jusqu'à 50 000 dinars," plus prison for proven fraud. Adhesion is remote via approved suppliers listed on jibaya.tn; the DGI system is called NACEF.
- **Pricing norms:** a coffee costs ~1 TND in medinas up to ~3.5 TND in hotels; a budget meal 10–25 TND, mid-range 40–80 TND. Food-service inflation has run high (the "restaurants, cafés et hôtels" services group rose 11.4% year-on-year at one INS reading), so owners are highly cost-sensitive.

### Competitors
- **Local QR-menu players (all web/PWA, no native customer app):** Digital Menu TN (digitalmenu.tn, Bizerte; "à partir de 16 DT/mois"; AR/FR/EN; real-time kitchen transmission; loyalty; self-reports 50–100+ venues — internally inconsistent); Scanny (scanny.tn; single flat "forfait abordable," price not published; web-only; real-time orders + optional POS); MAGH-QR (maghqr.net; free sign-up; integrated mobile payment incl. tickets restaurants); DigiResto (digiresto.tn; free; order routing to staff devices); Menu QR Code (menuqrcode.tn; no published price). Tacmenu is **Moroccan** (MAD pricing, e.g. 1,000 DH/yr basic, 6,999 DH/yr Pro+Caisse), not a Tunisian operator.
- **Local POS players** (relevant because of the cash-register mandate): Caissa (caissa.tn; transparent pricing ~40 TND/month, 210 TND/year, 360 TND/2yr; 15-day free trial), Poslik, TNPOS, ASMPOS, Innova Soft (most quote-based).
- **Regional/global:** Foodics (Saudi RMS/POS, MENA-wide), Oracle Simphony, and web QR tools (Jamezz, GloriaFood, MyDigiMenu). None are Tunisia-localized with a native consumer app.
- **The whitespace:** No competitor in Tunisia ships a beautiful native customer app with deep-linked QR scanning plus an AI insights layer. That is the wedge. Only Digital Menu TN publishes a clear TND QR-menu price (from 16 TND/month) and Caissa is the firmest POS pricing anchor.

### Technology
- **Supabase** wins over Firebase here: relational data (restaurants→menus→orders), Postgres Row-Level Security for multi-tenancy, predictable flat pricing (Free tier: 500MB DB, 1GB storage, 50,000 MAU, unlimited API requests; Pro $25/month with daily backups and no auto-pause), built-in Realtime over Postgres logical replication for live order updates, and pgvector for the AI layer. Firebase's per-operation billing is unpredictable for read-heavy dashboards.
- **Expo (React Native)** is the recommended mobile framework: fastest path to MVP, one JS/TS codebase for iOS+Android, EAS Build (no Mac needed), OTA updates via EAS Update, Expo Router handling deep linking/universal links out of the box, and the largest AI-coding training corpus — the best choice for handing to Claude Code. Flutter is stronger for pixel-perfect custom animation but slower to MVP and weaker for a JS-shared web codebase.
- **Next.js on Vercel** for both the scan-fallback web app and the business portal (business.{domain}.com), with SSR for fast first paint on mobile networks.
- **LLM layer:** use a cheap model (Gemini Flash-Lite or GPT-4o-mini class, roughly $0.10–0.60 per million tokens historically; note 2026 price increases) for narrative insights, run nightly in batch to cut cost ~50%. Most analytics should be plain SQL aggregations, not LLM calls — reserve the LLM for natural-language summaries and recommendations.

---

## Details

### 1. Tunisia Market Analysis
Tunisia is a highly connected, urban, Android-dominated, French/Arabic bilingual market with a huge but largely informal café/restaurant base. The realistic serving ground is greater Tunis (roughly one-fifth of the population lives in the Greater Tunis metro area), where higher-income, tech-forward venues cluster (La Marsa, Gammarth, Berges du Lac 1 & 2, Sidi Bou Saïd, downtown Tunis).

**TAM/SAM/SOM (best-estimate, flagged as derived):** With organized cafés/restaurants numbering ~20,000+ nationally and greater Tunis holding a meaningful share, a conservative serviceable market is several thousand registered mid-to-upmarket venues in greater Tunis. At 59–99 TND/month, capturing even 300–500 venues implies ~210,000–590,000 TND/year of recurring revenue. Because so many venues are informal, the reachable near-term market is the "organized," registered, mid-to-upmarket segment — precisely the segment now legally forced to adopt digital cash registers.

**Adoption drivers:** the cash-register mandate (digitization is now non-optional); high smartphone penetration; owner desire to cut printing costs, speed table turns, and look modern; tourist-friendly multilingual menus. **Resistance factors:** cost sensitivity amid inflation; staff/owner tech literacy; skepticism that customers will download an app; cash-first culture (which is exactly why the MVP is order-only, pay-at-cashier).

**Language/culture:** Tunisian Arabic (Derja) is the spoken norm, French is the business/menu lingua franca, and English serves tourists. The product must support Arabic (RTL), French, and English, with French likely the default portal language and Arabic RTL fully mirrored for customers.

### 2. Customer App — Feature List (Prioritized)

**MVP (launch):**
- QR scan → deep-link flow (see architecture) that opens the venue + table context.
- Menu browsing: categories, item detail pages, high-quality photos, price in TND, description.
- Modifiers/options (size, extras, sugar level for coffee), allergens, dietary tags (vegetarian, vegan, halal-by-default context).
- Cart with quantity, notes to kitchen, and per-item modifiers.
- Place order to the table (no payment) — order tied to table number from the QR.
- Order status/tracking (received → preparing → served).
- "Call the waiter" button.
- Multi-language (AR/FR/EN) with instant switch and RTL mirroring.
- Offline/poor-connection handling: cache last menu, queue order submission, show clear retry states.
- Accessibility: large tap targets, high contrast, dynamic type, screen-reader labels.

**Phase 2:** favorites, reviews/ratings, order history, personalized upsell at order time ("goes well with…"), group/split ordering at a table (multiple phones on one table session), reorder, promotions/happy-hour surfacing.

**Phase 3:** loyalty/points, online payment (Flouci/D17/Konnect/e-DINAR), reservations, delivery/takeaway.

### 3. Business Portal — Feature List (Prioritized)
Hosted at business.{domain}.com.

**MVP:**
- Real-time order dashboard (floor + kitchen views) with live push via Supabase Realtime; new-order sound/alert; status transitions.
- Menu management: CRUD on categories/items/modifiers, photo upload, price edits, availability toggles (86-ing an item instantly).
- QR/table management: create tables, generate/print QR codes (one permanent QR per table encoding venue+table).
- Staff accounts + role-based permissions (owner / manager / waiter / kitchen) via RLS.
- Basic analytics: sales by day, top items, order volume.
- Settings: venue profile, languages, hours.

**Phase 2:** AI insights (below), advanced analytics dashboards, notifications, review management, promotions engine.

**Phase 3:** multi-location support, inventory hints, staffing suggestions, POS/cash-register integration for fiscal compliance.

### 4. Technical Architecture

**Stack:** Expo/React Native (customer app, iOS+Android) · Next.js (web scan-fallback + business portal) on Vercel · Supabase (Postgres, Auth, Realtime, Storage, Edge Functions, RLS) · Gemini Flash-Lite/GPT-4o-mini for AI narratives.

**Multi-tenancy:** single Postgres database; every domain table carries `restaurant_id`, enforced by Row-Level Security policies keyed to the authenticated staff user's restaurant. Customers order without auth (anonymous session tied to the table token). One codebase serves all venues securely.

**Data model (key tables):**
- `restaurants` (id, name, slug, languages, default_lang, timezone, logo, theme)
- `users`/`staff` (id, restaurant_id, role, name, phone, auth_uid)
- `roles`/`permissions` (owner/manager/waiter/kitchen)
- `categories` (id, restaurant_id, name_i18n, sort_order)
- `items` (id, restaurant_id, category_id, name_i18n, description_i18n, price_tnd, photo_url, is_available, allergens[], dietary_tags[])
- `modifiers`/`modifier_groups` (id, item_id, name_i18n, price_delta, min/max select)
- `tables` (id, restaurant_id, label, qr_token)
- `orders` (id, restaurant_id, table_id, status, created_at, session_id, total_tnd)
- `order_items` (id, order_id, item_id, qty, unit_price, modifiers_json, notes)
- `reviews` (id, restaurant_id, item_id?, rating, comment, sentiment)
- `events`/`analytics` (id, restaurant_id, type, payload, created_at) — powers peak-hour and behavior insights.

**Real-time order flow:** customer submits → INSERT into `orders`/`order_items` → Supabase Realtime broadcasts `postgres_changes` filtered by `restaurant_id` → portal kitchen/floor views update instantly → staff advances status → customer app subscribes to its order row and reflects status.

**API design:** Supabase auto-generated REST/GraphQL for CRUD under RLS; Edge Functions for order placement (validation, table-token check), QR/deep-link redirect logic, and nightly AI insight generation.

**QR deep-linking / universal-links architecture (the scan-to-app funnel):**
1. Each table QR encodes an HTTPS link on your domain, e.g. `https://go.{domain}.com/r/{restaurantSlug}/t/{tableToken}`.
2. Serve `apple-app-site-association` (iOS Universal Links) and `assetlinks.json` (Android App Links) on the domain so an installed app opens directly to the venue+table screen.
3. If the app is installed → the OS opens it deep-linked to the menu with table context.
4. If not installed → the Next.js web page loads a best-in-class web ordering experience PLUS a prominent "Open in App / Download" smart banner. On social in-app browsers (Instagram/Facebook), detect the user-agent and show an explicit "Open in App" button.
5. Deferred deep linking: after install, the app retrieves the intended venue+table (persist via a server-side click record / branded fallback) so first launch lands on the right menu. Constraint: Apple/Google privacy rules prevent direct store-to-app data passing, so use contextual signals / a lightweight self-hosted deferred-link record rather than assuming a third-party SDK.
6. Keep the QR permanent; the destination is dynamic. Monitor the association files monthly — they break silently and can cost a large share of deep-link opens.

**AI insights pipeline:** a nightly Edge Function aggregates orders/events with SQL (top/bottom items, peak hours, average ticket, item margins if cost is entered), then sends a compact summary to a cheap LLM to produce natural-language recommendations in FR/AR/EN. Store results; render them as cards in the portal. Keep raw analytics as SQL/charts (cheap, deterministic); use the LLM only for the "what should I do" narrative.

### 5. UI/UX Design System
Quality bar: Apple/Netflix-grade.
- **Color palette:** a confident brand primary (e.g., deep terracotta/olive or Mediterranean teal evoking Tunisian tilework) + warm neutral greys; semantic colors for success/preparing/served; dark-mode support.
- **Typography:** a family with excellent Arabic + Latin coverage — Cairo, Tajawal, IBM Plex Arabic, or Noto Sans Arabic for Arabic; Inter for Latin. Increase Arabic heading/button sizes ~10% vs Latin for visual balance.
- **Spacing:** 4/8pt grid, generous whitespace, thumb-friendly 44–48px targets.
- **Components:** a proven RN UI kit (Tamagui or React Native Paper/NativeWind) + Reanimated for motion; portal on shadcn/ui + Tailwind.
- **Motion:** subtle, purposeful (add-to-cart, order-status transitions). Mirror motion/directional icons in RTL; never mirror media/playback controls or clocks.
- **RTL:** full layout mirroring via CSS logical properties / RN `I18nManager`; right-align Arabic; keep Western numerals LTR; test with realistic bilingual strings (Arabic length differs meaningfully from Latin).
- **States:** designed empty states (no orders yet), skeleton loading, explicit error + retry (critical on poor connectivity), optimistic UI for cart.
- **Accessibility:** WCAG contrast, screen-reader labels, dynamic type, no color-only status.

### 6. Cost-Effectiveness

**At launch (first 10–50 restaurants):**
- Supabase: Free tier likely sufficient initially (500MB DB, 1GB storage, 50k MAU, unlimited API requests); move to Pro ($25/month) for daily backups, no auto-pause, and headroom.
- Vercel: Hobby free for early testing; Pro (~$20/month) when going commercial.
- Expo EAS: Free tier (15 iOS + 15 Android builds/month, OTA updates to 1,000 MAU); paid Starter (~$19/month) only when build/update volume grows.
- Apple Developer ($99/year) + Google Play ($25 one-time).
- Domain (~$12/year) + LLM usage (a few dollars/month at low volume, batched).
- **Total: roughly $0 to start, ~$25–70/month once on paid tiers** — well within a lean bootstrapped budget.

**Scaling behavior:** Supabase scales by compute/storage tiers predictably (Pro Micro instance covered by the $10 compute credit; scale one project's compute without changing plan). Costs stay largely fixed per-tier rather than per-request — ideal for read-heavy dashboards. Watch egress (image-heavy menus) and Edge Function invocations; serve menu images via Supabase Storage/CDN with resizing.

### 7. Business Model & Pricing
- **Model:** monthly SaaS per location. Suggested tiers: **Starter ~59 TND/month** (menu + QR + basic orders + analytics), **Pro ~99 TND/month** (AI insights, multi-staff roles, promotions, reviews), plus a **later add-on** for online payment and multi-location. Annual prepay discount (~2 months free).
- **Free trial + free onboarding:** 14–30 day free trial; the team digitizes the menu and prints QR cards for the owner (white-glove) to remove setup friction — a key lever given owner tech-literacy concerns. Benchmarks: local POS Caissa offers a 15-day free trial at ~40 TND/month; Digital Menu TN starts at ~16 TND/month for web-only. Position **above** them on value (native app + AI), not on being cheapest.
- **Unit economics:** infra cost per venue is a few dinars/month at scale; at 59–99 TND/month gross margins are very high (80%+). Main costs are sales/onboarding labor and support.
- **Profitability path:** with near-zero marginal infra cost, breakeven is driven by CAC/onboarding time. Founder-led sales of 10–20 venues covers all infra many times over; the model is profitable at low tens of venues.
- **Go-to-market:** (1) target upmarket, tourist-facing, tech-forward cafés/restaurants in greater Tunis first; (2) founder-led direct sales — walk in, demo the live native app on a phone; (3) use the cash-register mandate as the urgency hook ("you're digitizing anyway — add ordering + insights"); (4) free menu setup + printed QR table cards as the close; (5) reference customers → referrals; (6) later, partner with approved cash-register suppliers listed on jibaya.tn.

### 8. Phased Roadmap
- **Phase 0 (build, ~4–8 weeks with Claude Code):** design system, data model + RLS, customer app MVP, portal MVP, QR deep-link infra, realtime orders, AR/FR/EN.
- **Phase 1 (launch):** onboard first 10–20 Tunis venues, white-glove menu setup, iterate on real orders.
- **Phase 2:** AI insights layer, reviews, promotions, favorites, group ordering, richer analytics.
- **Phase 3:** online payment (Flouci/D17/Konnect/e-DINAR), loyalty, multi-location, inventory/staffing hints, optional fiscal cash-register integration.

### 9. Notes for Handing to Claude Code
Provide: the exact data model/RLS policies above; the deep-link URL scheme + association-file requirements; the Supabase Realtime channel design; the i18n key structure (namespaced JSON, no hardcoded strings, RTL-aware); design tokens (colors, type scale, spacing); component-library choices; the nightly AI Edge Function contract (SQL aggregation → LLM prompt → stored insight cards); and acceptance criteria for offline/poor-connection behavior. Instruct it to build the customer app (Expo), web fallback + portal (Next.js), and Supabase schema/functions as one monorepo.

---

## Recommendations
1. **Start building now on Expo + Next.js + Supabase (Vercel).** Ship the order-only MVP + portal + QR deep-link funnel first. Defer payment entirely.
2. **Lead sales with the cash-register-mandate urgency** and the native-app + AI differentiation no local competitor has. Target 10–20 greater-Tunis venues with free onboarding.
3. **Price at 59 TND (Starter) / 99 TND (Pro), 14–30 day trial, annual discount.** Reassess upward if churn is low and AI insights prove sticky.
4. **Design Android-first, Arabic-RTL-complete, French-default.** Test on entry/mid Android and poor networks.
5. **Keep AI cheap:** SQL for analytics, batched cheap-LLM for narratives only.
6. **Benchmarks to change course:** if <30% of scanning customers install the app, double down on the web fallback experience and treat the app as premium; if venues resist 99 TND, bundle AI into a single ~79 TND plan; if monthly churn exceeds 5%, invest in onboarding/support before new sales.

## Caveats
- Café/restaurant counts and TAM are best estimates from mixed reporting (organized ~20,000 cafés + a large informal segment); no single authoritative census exists — treat as directional.
- LLM prices move fast (some 2026 increases noted); validate current model rates before committing.
- Competitor pricing is partly unpublished (Scanny, MAGH-QR, most local POS quote-based); Digital Menu TN "from 16 TND/month" and Caissa figures are the firmest anchors.
- The cash-register-mandate details (dates, 50,000 TND fines, NACEF/jibaya.tn) come from Tunisian press (La Presse, L'Économiste Maghrébin, allAfrica) and should be verified against the official arrêté before making legal claims to customers.
- Deferred deep linking is constrained by Apple/Google privacy rules; plan for graceful web fallback rather than guaranteed store-to-app context passing.