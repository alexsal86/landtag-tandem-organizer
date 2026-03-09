import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Shared CORS headers for all edge functions.
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Auth Guard ───────────────────────────────────────────────────────────────

export interface AuthResult {
  userId: string;
  email?: string;
}

/**
 * Validates the Authorization bearer token and returns the authenticated user.
 * Returns `null` when the token is missing or invalid – the caller should then
 * return `unauthorizedResponse()`.
 */
export async function requireAuth(req: Request): Promise<AuthResult | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return { userId: data.user.id, email: data.user.email ?? undefined };
}

// ─── Role Guard ───────────────────────────────────────────────────────────────

/**
 * Checks whether the user holds a specific role via the `has_role` RPC.
 */
export async function requireRole(
  userId: string,
  role: string,
): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: role,
  });
  return data === true;
}

// ─── Cron / Internal Guard ────────────────────────────────────────────────────

/**
 * Validates that a request originates from a Supabase cron/internal trigger
 * by checking the Authorization header against SUPABASE_SERVICE_ROLE_KEY.
 * Use this for scheduled functions that must not be callable by end-users.
 */
export function requireServiceRole(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return token === serviceRoleKey && serviceRoleKey.length > 0;
}

// ─── Safe Error Responses ─────────────────────────────────────────────────────

/**
 * Returns a generic 401 response without leaking internal details.
 */
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/**
 * Returns a generic 403 response.
 */
export function forbiddenResponse(message = "Forbidden"): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/**
 * Returns a safe 500 response, logging the full error server-side but only
 * sending a generic message to the client. **Never** exposes stack traces.
 */
export function safeErrorResponse(
  error: unknown,
  context: string,
  status = 500,
): Response {
  // Log full details server-side for debugging
  console.error(`[${context}]`, error);

  return new Response(
    JSON.stringify({ error: "Internal server error" }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/**
 * Wraps a handler with CORS preflight + global error catching that never leaks
 * stack traces. Usage:
 *
 * ```ts
 * import { withSafeHandler } from "../_shared/security.ts";
 * Deno.serve(withSafeHandler("my-function", async (req) => { ... }));
 * ```
 */
export function withSafeHandler(
  functionName: string,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      return await handler(req);
    } catch (err: unknown) {
      return safeErrorResponse(err, functionName);
    }
  };
}
