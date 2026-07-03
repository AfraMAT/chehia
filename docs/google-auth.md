# Google Sign-In (staff & admin portals)

Chehia lets restaurant **staff/owners** and **platform admins** sign in with Google,
in addition to email + password. Customers stay anonymous — they never sign in.

## How it works (and why it's safe)

- Google **authenticates**; it does **not** grant access. After a Google sign-in the
  `/auth/callback` page resolves the user's role from the database:
  - a row in `platform_admins` → `/admin`
  - an active row in `staff` → `/business/orders`
  - neither → the user is signed straight back out with a "no access" screen.
- Staff/admins are provisioned (via `admin-provision-business` / `create-staff`) as
  auth users with a **confirmed** email. Supabase automatically links a Google
  identity to an existing account with the same confirmed email, so a provisioned
  owner/admin keeps the **same `auth_uid`** and is recognized. No new table columns,
  no linking RPC.
- The Client ID/Secret live **only in Supabase Auth** — never in the app bundle, Vercel,
  or `.env`. There is **no app env var** to set for Google auth on the web.

## One-time setup

### 1. Create the Google OAuth client

1. [console.cloud.google.com](https://console.cloud.google.com/) → create/select a project **Chehia**.
2. **APIs & Services → OAuth consent screen** → External:
   - App name `Chehia`, support + developer email.
   - **Authorized domains:** `chehia.app`, `supabase.co`.
   - Scopes: defaults (`email`, `profile`, `openid`) — non-sensitive, **no Google review needed**.
   - **Publish app** (otherwise only listed test users can sign in).
3. **Credentials → Create credentials → OAuth client ID → Web application** (`Chehia Web`):
   - **Authorized redirect URIs** (both):
     - `https://wpnouppukofzmvsieyeq.supabase.co/auth/v1/callback`  (prod project `chehia`)
     - `https://sxmbqwldtqkkmlfbjyzc.supabase.co/auth/v1/callback`  (dev project `chehia-dev`)
   - Copy the **Client ID** + **Client Secret**. One client covers both environments.

### 2. Configure Supabase (dashboard, per project)

Do the **dev** project first (prod only when shipping to production):

1. **Authentication → Providers → Google** → enable → paste Client ID + Secret → Save.
2. **Authentication → URL Configuration → Redirect URLs**, add:
   - `http://localhost:3000/**`
   - `https://*.chehia.app/**`
   - `https://*-aframat.vercel.app/**`  (Vercel previews)
3. **Site URL:** prod → `https://chehia.app`; dev → the develop preview URL.

The redirect target is always `<current-origin>/auth/callback`, computed from
`window.location.origin`, so it works on localhost, previews, and every subdomain.

### 3. Local Supabase stack (optional)

`supabase/config.toml` already has an `[auth.external.google]` block driven by env vars.
To use Google on the local stack:

```bash
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=…
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=…
supabase start
```

(Not required for preview/prod, which are configured in the dashboard.)

## Code touchpoints

| File | Role |
|------|------|
| `apps/web/src/lib/supabase.ts` → `signInWithGoogle(ctx)` | starts the OAuth redirect |
| `apps/web/src/components/google-signin.tsx` | the "Continue with Google" button + divider |
| `apps/web/src/app/auth/callback/page.tsx` | exchanges the code, resolves role, routes |
| `apps/web/src/app/business/login/page.tsx`, `apps/web/src/app/admin/login/page.tsx` | render the button |
| `packages/shared/src/i18n/*` → `auth.*` | trilingual labels |

## Testing on preview

Preview deployments sit behind Vercel authentication, so the Google round-trip only
completes in a browser already signed in to the Vercel account (the owner's). The button,
divider, and callback UI can be verified without a live Google exchange; the full
end-to-end sign-in is best confirmed by the account owner on the preview URL, or on prod
once the prod Supabase project has the provider configured.
