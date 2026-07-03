import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/**
 * Backend selection. A RELEASE build defaults to the PROD Supabase project — its
 * publishable (anon) key is public and safe to ship, since Row-Level Security is
 * the real trust boundary. EXPO_PUBLIC_* env vars (injected by eas.json build
 * profiles, or a local .env for development) OVERRIDE this default: dev/preview
 * builds point at the dev project, and local development can point at the local
 * stack (http://127.0.0.1:54321 on the iOS simulator, http://10.0.2.2:54321 on
 * the Android emulator). This guarantees a store build is never wired to localhost.
 */
const PROD_URL = "https://wpnouppukofzmvsieyeq.supabase.co";
const PROD_ANON_KEY = "sb_publishable_3-8-FFBSDKTgLm9aqQwjdw_HFYQ3-Pu";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? PROD_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? PROD_ANON_KEY;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** Ensure the customer has a (possibly anonymous) session; returns the user id. */
export async function ensureCustomerSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error("anonymous sign-in failed");
  return anon.user.id;
}

export function functionsUrl(name: string): string {
  return `${url}/functions/v1/${name}`;
}

export const supabaseAnonKey = anonKey;
