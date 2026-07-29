# Chehia — Google Play submission

**Path chosen: personal developer account.** Written 2026-07-28. Package `tn.chehia.app`,
version `1.0.0`, `versionCode 2`.

Everything about *cloud* state here (what Play Console shows, what's been uploaded) is a
snapshot — verify it live before acting on it. The Google policy facts are sourced inline.

---

## 0. The shape of it — read this first

A personal account created today falls under Google's testing rule: **12 testers opted in for
14 continuous days** before you may even *apply* for production. That application is then
reviewed ("usually 7 days or less"). So the honest timeline is **~4 weeks**, and almost all of
it is waiting, not working.

| When | What happens | Who |
|---|---|---|
| Day 0 | Create account, pay $25, submit ID | You |
| Day 0 | **Start recruiting 12 testers** — this is the real critical path | You |
| Day 1–3 | Google verifies your identity | Google |
| Day 3 | Create the app, fill the listing + all content declarations | Me (values) / you (paste) |
| Day 3 | Upload the AAB to **closed testing** | You or `eas submit` |
| Day 3–5 | Google reviews the closed-test release | Google |
| Day 5 | 12 testers accept the opt-in link → **the 14-day clock starts here** | Your testers |
| Day 19 | Apply for production access (3-part questionnaire) | You |
| Day 19–26 | Google reviews the application | Google |
| Day 26 | Create the production release → app review → live | You |

Two things that trip people up, both from
[Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en):

- **The clock starts when 12 testers are opted in, not when you create the test.** Recruiting
  late costs you the whole delay.
- **Continuous.** If you drop below 12 at any point the streak resets. Over-recruit — get
  15–16 so a couple of drop-outs don't restart two weeks.
- **Internal testing does not count.** It's a separate track. Useful for our own QA, worthless
  for this requirement. It must be the **closed** track.

### About the account type

You picked personal, which is the right call to *start today* — organization accounts need a
D-U-N-S number that takes [8–30 business days](https://www.dnb.com/duns-number/lookup/request-a-duns-number.html).
Two consequences to know about, neither fatal:

- Your **legal name becomes the public developer name** on the listing (the displayed developer
  name can be edited later in Play Console → Settings → Developer account → Account details).
- An **organization account is mandatory** if you ever add financial services, health, VPN or
  government features ([account types](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en)).
  Chehia takes no in-app payment, so none of these apply today.

---

## 1. Create the developer account

1. Go to **https://play.google.com/console/signup**
2. Sign in with the Google account that should **own** Chehia forever. Use a real business
   mailbox you control, not a throwaway — moving an app between accounts later is painful.
3. Choose **"Yourself"** (personal), not "An organization".
4. Fill in your details. The name must match your government ID **exactly**.
5. Pay the **$25 USD one-time** registration fee.
6. Upload your government ID when prompted. Verification is typically 1–3 days.
7. Accept the Developer Distribution Agreement.

While you wait for verification, do step 2 — do not sit idle, it's the long pole.

---

## 2. Recruit the 12 testers — start today

They must be **real people, on real Android devices, with real Google accounts**. Emulators
and duplicate accounts do not count, and Google does look.

Aim for **15–16 people** so drop-outs don't reset the streak. Good candidates: staff at the
café you're piloting with, family, friends, anyone in your network with an Android phone.

Collect their **Gmail addresses** into a list now. That is literally all you need from them
up front — the opt-in link comes later, in step 6.

### The message to send them

Send this now to line people up, then send the opt-in link when you have it (step 6). Ask each
person to reply "ok" so you know you have 12+ committed before the clock matters.

**French:**

> Salut ! Je lance mon app **Chehia** (commande au café par QR code) sur le Play Store et j'ai
> besoin de 12 personnes pour la tester pendant 2 semaines. Ça te prend 2 minutes :
> 1. Tu ouvres le lien que je t'envoie sur ton téléphone Android
> 2. Tu appuies sur « Devenir testeur », puis tu installes Chehia
> 3. Tu la laisses installée 3 semaines et tu l'ouvres de temps en temps
>
> C'est gratuit et il n'y a rien à payer dans l'app. Tu peux ? Réponds-moi juste « ok » et
> envoie-moi ton adresse Gmail.

**Arabic:**

> أهلاً! نحب نطلّق تطبيقي **شهية** (تطلب في القهوة عن طريق رمز QR) على متجر Play،
> ولازمني 12 شخص باش يجرّبوه مدة أسبوعين. ما ياخذش كان دقيقتين:
> 1. تحلّ الرابط اللي نبعثهولك في تليفونك أندرويد
> 2. تضغط على «كن مختبراً» (Become a tester) وبعدها تنزّل شهية
> 3. تخلّيها مركّبة مدة 3 أسابيع وتحلّها من وقت لآخر
>
> التطبيق مجاني، وما فيه حتى خلاص. تنجّم تعاوني؟ جاوبني «أوكي» وابعثلي عنوان Gmail متاعك.

**English:**

> Hey! I'm launching my app **Chehia** (order at the café by QR code) on the Play Store and I
> need 12 people to test it for 2 weeks. Takes 2 minutes:
> 1. Open the link I send you, on your Android phone
> 2. Tap **Become a tester**, then install Chehia
> 3. Leave it installed for 3 weeks and open it now and then
>
> It's free and there's nothing to pay inside the app. Can you? Just reply "ok" and send me
> your Gmail address.

⚠️ **Gmail addresses, not phone numbers** — Play opt-in is tied to the Google account. And it
must be an **Android** phone; iPhone users cannot help here.

---

## 3. Create the app in Play Console

Once your account is verified:

1. Play Console → **All apps** → **Create app**
2. **App name:** `Chehia` (see the listing section for the exact final values)
3. **Default language:** French (France) — `fr-FR`
4. **App or game:** App
5. **Free or paid:** **Free** ← this cannot be changed to paid later, but Chehia is free
6. Tick the two declarations (Developer Program Policies, US export laws)
7. **Create app**

---

## 4. Fill in the store listing and content declarations

Play Console gives you a dashboard checklist. **Every one of these has an exact, evidence-backed
value prepared for you in `docs/play-store-pack.md`** — open it side by side and copy across.
That file also carries the fr/ar/en listing copy with character counts, the full Data safety
table, and the IARC content-rating answers.

- Store listing (name, short description, full description, graphics) — in **fr, ar, en**
- App category and contact details
- Privacy policy URL → `https://chehia.app/legal/privacy` (verified live, and it covers
  location, camera, retention, deletion and a contact address)
- App access → all functionality available without special access, **plus** the demo notes
- Ads → No
- Content rating → IARC questionnaire
- Target audience and content
- Data safety
- Government apps / Financial features / Health / News / COVID-19 → all No

**Graphics are ready** at `~/Desktop/chehia-play-graphics/`:

| Asset | Required | Status |
|---|---|---|
| App icon | 512×512 PNG | ✅ `play-icon-512.png` |
| Feature graphic | 1024×500 PNG | ✅ `play-feature-graphic-1024x500.png` |
| Phone screenshots | 2–8, sides 320–3840 px | ✅ **7 French frames at 1080×2400** in `~/Desktop/chehia-play-screenshots-fr/` |

The screenshots are real Android captures from an API 35 emulator, in French (your default
listing language), already ordered for impact — upload them in filename order:

| # | File | Screen |
|---|---|---|
| 1 | `01-menu.png` | category grid with the illustrated menu art — the strongest frame |
| 2 | `02-item.png` | item detail: sizes, extras, allergens, a guest review |
| 3 | `03-suivi.png` | live order tracking, Reçue → En préparation → Servie |
| 4 | `04-accueil.png` | landing — "Scannez. Commandez. Régalez-vous." |
| 5 | `05-table.png` | the scanned table, "Vous payez au comptoir" |
| 6 | `06-cafes.png` | a category's items with prices and diet tags |
| 7 | `07-panier.png` | cart — "Paiement au comptoir — aucune carte requise" |

Play shows only the **first few** in the listing preview, which is why the menu, item detail
and live tracking lead. You do **not** need Arabic or English sets: Play falls back to the
default language's screenshots for any localization you leave empty.

---

## 5. Countries

Match the iOS decision: **exclude the EU**. Play carries the same Digital Services Act trader
obligation as the App Store, and declaring trader status publishes your name, address and phone
on the listing. You operate in Tunisia; there is no reason to take that on.

Play Console → your release → **Countries / regions** → add all, then remove the 27 EU member
states. (Or select Tunisia only, and widen later — this is reversible either way.)

---

## 6. Upload the AAB to the closed track

The production AAB is built and waiting on EAS. Two ways in:

**Option A — through the Console (simplest for the first one):**
1. Download the `.aab` from the EAS build page.
2. Play Console → **Testing** → **Closed testing** → **Create new release**.
3. Let Google **manage app signing** (this is the default and is required — see §7).
4. Upload the `.aab`, add release notes, **Save** → **Review release** → **Start rollout**.

**Option B — `eas submit` (what you'll want for every future update):**
1. Play Console → **Setup** → **API access** → link a Google Cloud project.
2. Create a service account there, then grant it access in Play Console with permission to
   release to testing tracks.
3. Download its JSON key and save it as `apps/mobile/play-service-account.json` (gitignored;
   `eas.json` already points at that exact path).
4. `cd apps/mobile && eas submit -p android --profile production`

Expo confirms the first submission works via the API — a manual first upload is *optional*,
not required ([EAS Submit docs](https://docs.expo.dev/submit/android/)).

Then: **Testers** tab → add your 15–16 Gmail addresses → copy the **opt-in URL** → send it out.
The 14-day clock starts when the twelfth person accepts.

---

## 7. Fix Android App Links — do this right after the first upload ⚠️

**This is a real defect today, and it breaks the core flow.**

`app.json` declares an intent filter for `app.chehia.app/r` with `autoVerify: true`. Android
only honours that if the domain serves a matching `assetlinks.json`. Right now:

```
https://app.chehia.app/.well-known/assetlinks.json  →  404 "Not configured"
```

Until it serves, **scanning a table QR opens Chrome instead of the Chehia app.**

The route already exists (`apps/web/src/app/.well-known/assetlinks.json/route.ts`) and just
needs the env var. It takes **two** fingerprints:

- **EAS upload key** (known): `1c1fdf41e99bb24f22e43e17447d886539b36ebf0ad02b89913dd3d53a2b3cce`
- **Google Play app-signing key** (unknown until you upload) — Play Console → **Test and
  release** → **Setup** → **App integrity** → *App signing key certificate* → copy the SHA-256

Then set in Vercel (production), comma-separated, and redeploy:

```
ANDROID_CERT_SHA256 = <google-play-sha256>,1c1fdf41e99bb24f22e43e17447d886539b36ebf0ad02b89913dd3d53a2b3cce
```

Verify with `curl https://app.chehia.app/.well-known/assetlinks.json` — it must return JSON, not
404. Google's own checker: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://app.chehia.app&relation=delegate_permission/common.handle_all_urls`

The Play key is the one that matters for installs from the Store; the upload key covers the
APKs we side-load for testing. Ship both.

---

## 8. Apply for production access (day ~19)

Play Console → **Dashboard** → the production access card. It's a three-part questionnaire:

1. **About your closed test** — how you recruited, how engaged testers were, what feedback you got
2. **About your app** — intended audience, value proposition, expected installs
3. **Production readiness** — what you changed based on testing, why it's ready

Answer honestly and specifically; generic answers get bounced. Keep a note during the two weeks
of anything a tester reports, so part 1 and part 3 write themselves.

Review is "usually 7 days or less".

---

## 9. Production release

1. Play Console → **Production** → **Create new release**
2. Reuse the AAB already reviewed in closed testing (**Add from library**) — no rebuild needed
   unless code changed
3. Release notes, countries (§5), **Review release** → **Start rollout to Production**
4. Consider a **staged rollout** (20% → 50% → 100%) so a bad build doesn't hit everyone

---

## 10. The API-36 deadline — closed

Google raises the target-API bar to **API 36 on 31 August 2026**, which the ~4-week timeline
above would have run straight into. Verified directly from the built APK with
`aapt2 dump badging`: **`targetSdkVersion 36`, `compileSdkVersion 36`**. No action needed.

---

## 11. What's done vs what's yours

**Done (me):**
- Production AAB + preview APK, rebuilt from `e0da988` at `versionCode 3`
- **One Play policy blocker fixed** — displayed user reviews had no in-app report path
  (Inappropriate Content / UGC). Plus four Android defects an iOS-only test pass missed:
  Directions opened Apple Maps, hardware Back quit the app from the QR scanner,
  `pathPrefix "/r"` also claimed `/robots.txt`, and Auto Backup was shipping the secret
  `qr_token` to Google Drive. See `d22bf22`.
- 512 icon + 1024×500 feature graphic generated (`~/Desktop/chehia-play-graphics/`)
- Android emulator QA on API 35 — deep link, menu, illustrations verified
- Store listing copy in fr/ar/en, Data safety table, content-rating answers →
  `docs/play-store-pack.md`
- Found the assetlinks defect (§7); confirmed `targetSdkVersion 36` (§10)

**Yours (nobody else can do these):**
1. Create the account, pay $25, pass ID verification (§1)
2. **Recruit 15–16 testers — today** (§2)
3. Create the app, paste the listing values (§3, §4)
4. Upload the AAB to closed testing, send the opt-in link (§6)
5. Copy the Play app-signing SHA-256 back to me so app links work (§7)
6. Apply for production access after 14 days (§8)
7. Roll out to production (§9)
