export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({ error: { code, message } }, status);
}

/**
 * Read a JSON **object** body, or null if there isn't one.
 *
 * Every function used to hand-roll `try { input = await req.json() } catch {…}`
 * and then read `input.something`. That misses the case that matters: the
 * literal body `null` is *valid* JSON, so `req.json()` resolves rather than
 * throwing, the catch never runs, and the next property read throws a
 * TypeError — the function answers 500 with a stack trace instead of a clean
 * 400. `[]`, `"str"` and `3` are the same story. Seven functions had it,
 * including place-order.
 */
export async function readJsonObject<T>(req: Request): Promise<T | null> {
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}
