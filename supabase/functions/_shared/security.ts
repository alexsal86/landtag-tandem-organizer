import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Shared CORS headers for all edge functions.
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type SafeErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "internal_error";

export interface SafeErrorBody {
  error: {
    code: SafeErrorCode;
    message: string;
  };
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(
  status: 400 | 401 | 403 | 500,
  code: SafeErrorCode,
  message: string,
): Response {
  return jsonResponse({ error: { code, message } } satisfies SafeErrorBody, status);
}

// ─── Auth Guard ───────────────────────────────────────────────────────────────

export interface AuthResult {
  userId: string;
  email?: string;
}

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

export function requireServiceRole(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return token === serviceRoleKey && serviceRoleKey.length > 0;
}

// ─── Safe Error Responses ─────────────────────────────────────────────────────

export function badRequestResponse(message = "Bad request"): Response {
  return errorResponse(400, "bad_request", message);
}

export function unauthorizedResponse(): Response {
  return errorResponse(401, "unauthorized", "Unauthorized");
}

export function forbiddenResponse(message = "Forbidden"): Response {
  return errorResponse(403, "forbidden", message);
}

export function internalServerErrorResponse(): Response {
  return errorResponse(500, "internal_error", "Internal server error");
}

export function safeErrorResponse(
  error: unknown,
  context: string,
  status: 400 | 401 | 403 | 500 = 500,
): Response {
  console.error(`[${context}]`, error);

  if (status === 400) {
    return badRequestResponse();
  }

  if (status === 401) {
    return unauthorizedResponse();
  }

  if (status === 403) {
    return forbiddenResponse();
  }

  return internalServerErrorResponse();
}

export function withSafeHandler(
  functionName: string,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
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
