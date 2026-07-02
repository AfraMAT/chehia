import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_* values are inlined at build time, so they must be referenced
// literally for Next to replace them. Validation is lazy (at first use) so a
// missing variable fails with a clear, named error at runtime instead of a
// cryptic "supabaseUrl is required" from deep inside supabase-js.
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireConfig(): { url: string; anonKey: string } {
  if (!envUrl) throw new Error("Missing required environment variable NEXT_PUBLIC_SUPABASE_URL");
  if (!envAnonKey) throw new Error("Missing required environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url: envUrl, anonKey: envAnonKey };
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
