import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/**
 * Local dev: EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 works on the iOS
 * simulator; use your machine's LAN IP for physical devices, and
 * http://10.0.2.2:54321 for the Android emulator.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

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
