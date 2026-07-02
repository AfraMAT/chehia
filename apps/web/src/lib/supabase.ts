import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Backend selection is derived from the *deployment environment*, not from
// hosting-dashboard env vars. Supabase publishable keys are safe to ship in the
// client bundle (they already are — Row-Level Security is the real trust
// boundary), so we can hardcode the per-environment projects here. The upshot:
// `main`/production always talks to the prod project and every `develop`/preview
// deployment always talks to the dev project, with nothing to misconfigure in a
// dashboard and no way for a stale env var to point production at the wrong DB.
const PROD_CONFIG = {
  url: "https://wpnouppukofzmvsieyeq.supabase.co",
  anonKey: "sb_publishable_3-8-FFBSDKTgLm9aqQwjdw_HFYQ3-Pu",
};
const DEV_CONFIG = {
  url: "https://sxmbqwldtqkkmlfbjyzc.supabase.co",
  anonKey: "sb_publishable_pEBLwqR-_d8lIXtYTcIQRQ_n9NW_gqq",
};

// Injected at build time from Vercel's VERCEL_ENV (see next.config.ts):
// "production" on main, "preview" on every other branch, "" when built off Vercel.
const deployEnv = process.env.NEXT_PUBLIC_DEPLOY_ENV;

// Explicit local override — e.g. .env.local pointing at the local Supabase stack.
// NEXT_PUBLIC_* values are inlined at build time, so they must be referenced
// literally for Next to replace them.
const overrideUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const overrideAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validation is lazy (at first use) so a missing config fails with a clear, named
// error at runtime instead of a cryptic "supabaseUrl is required" from supabase-js.
function requireConfig(): { url: string; anonKey: string } {
  // On Vercel the branch decides the backend, ignoring any dashboard env vars.
  if (deployEnv === "production") return PROD_CONFIG;
  if (deployEnv === "preview") return DEV_CONFIG;
  // Off Vercel (local dev, CI): honour an explicit override, else fail clearly.
  if (overrideUrl && overrideAnonKey) return { url: overrideUrl, anonKey: overrideAnonKey };
  throw new Error(
    "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY for local development (see apps/web/.env.example).",
  );
}

let browserClient: SupabaseClient | null = null;

/**
 * Browser client — one instance per tab. Persists sessions in localStorage:
 * anonymous customer sessions on customer routes, staff sessions in the portal.
 */
export function getSupabase(): SupabaseClient {
  if (!browserClient) {
    const { url, anonKey } = requireConfig();
    browserClient = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return browserClient;
}

/**
 * Server client for public reads (menus, restaurant info). No cookies, no
 * session — RLS public policies govern what it can see.
 */
export function getServerSupabase(): SupabaseClient {
  const { url, anonKey } = requireConfig();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Ensure the current browser user is signed in (anonymously if needed). */
export async function ensureCustomerSession(): Promise<string> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error("anonymous sign-in failed");
  return anon.user.id;
}

export function functionsUrl(name: string): string {
  return `${requireConfig().url}/functions/v1/${name}`;
}

/**
 * Invoke an edge function with the current (staff/admin) session token.
 * Returns the parsed body plus ok/status so callers can branch on error codes
 * without reimplementing the fetch + auth-header plumbing each time.
 */
export async function callFunction<T = unknown>(
  name: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const { anonKey } = requireConfig();
  const { data: sessionData } = await getSupabase().auth.getSession();
  const response = await fetch(functionsUrl(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as T | null;
  return { ok: response.ok, status: response.status, data };
}
