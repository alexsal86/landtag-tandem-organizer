import {
  createClient,
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://localhost:5173",
];

export function createCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const resolvedAllowedOrigins =
    allowedOrigins.length > 0 ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS;
  const allowOrigin = resolvedAllowedOrigins.includes(origin)
    ? origin
    : resolvedAllowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function safeErrorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  requestId: string,
) {
  return jsonResponse(
    { error: message, request_id: requestId },
    status,
    corsHeaders,
  );
}

export function buildRequestId() {
  return crypto.randomUUID();
}

export function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function getAuthenticatedUser(
  req: Request,
): Promise<
  { user: User; authClient: SupabaseClient } | { errorResponse: Response }
> {
  const requestId = buildRequestId();
  const authHeader = req.headers.get("Authorization");
  const corsHeaders = createCorsHeaders(req);

  if (!authHeader) {
    return {
      errorResponse: safeErrorResponse(
        "Missing authorization header",
        401,
        corsHeaders,
        requestId,
      ),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) {
    return {
      errorResponse: safeErrorResponse(
        "Unauthorized",
        401,
        corsHeaders,
        requestId,
      ),
    };
  }

  return { user, authClient };
}

export async function userCanAccessTenant(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  allowedMembershipRoles: string[] = [],
) {
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin", {
    _user_id: userId,
  });
  if (adminError) {
    throw new Error(`Failed admin check: ${adminError.message}`);
  }

  if (isAdmin) {
    return true;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("user_tenant_memberships")
    .select("role, is_active")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Failed membership check: ${membershipError.message}`);
  }

  if (!membership) {
    return false;
  }

  if (allowedMembershipRoles.length === 0) {
    return true;
  }

  return allowedMembershipRoles.includes(membership.role);
}
