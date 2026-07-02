import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let browserClient: SupabaseClient | null = null;

/**
 * Browser client — one instance per tab. Persists sessions in localStorage:
 * anonymous customer sessions on customer routes, staff sessions in the portal.
 */
export function getSupabase(): SupabaseClient {
  if (!browserClient) {
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
  return `${url}/functions/v1/${name}`;
}
