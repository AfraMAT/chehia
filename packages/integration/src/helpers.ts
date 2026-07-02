import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Local Supabase stack (values from `supabase status`). */
export const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
export const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
export const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const EL_MARSA_ID = "aaaaaaaa-0000-0000-0000-000000000001";
export const LE_ZINK_ID = "bbbbbbbb-0000-0000-0000-000000000002";
export const CAPPUCCINO_ID = "dddddddd-0000-0000-0000-000000000003";
export const EXPRESS_ID = "dddddddd-0000-0000-0000-000000000001";
export const ICED_COFFEE_ID = "dddddddd-0000-0000-0000-000000000005"; // seeded as unavailable
export const SIZE_S = "ffffffff-0000-0000-0000-000000000001";
export const SIZE_L = "ffffffff-0000-0000-0000-000000000003";
export const SUGAR_NONE = "ffffffff-0000-0000-0000-000000000011";
export const EXTRA_SHOT = "ffffffff-0000-0000-0000-000000000021";
export const T12_TOKEN = "demo-elmarsa-t12";
export const ZINK_T1_TOKEN = "demo-lezink-t01";

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function customerClient(): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return client;
}

export async function staffClient(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: "chehia-demo" });
  if (error) throw error;
  return client;
}

export async function callFunction(
  client: SupabaseClient,
  name: string,
  body: unknown,
): Promise<{ status: number; json: any }> {
  const { data: sessionData } = await client.auth.getSession();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${sessionData.session?.access_token ?? ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}
