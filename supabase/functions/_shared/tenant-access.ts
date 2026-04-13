import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "./security.ts";

interface RequireTenantAccessOptions {
  req: Request;
  functionName: string;
  requestedTenantId?: string | null;
}

interface TenantMembership {
  tenant_id: string;
  role: string | null;
}

interface TenantAccessSuccess {
  user: User;
  tenantId: string;
  membership: TenantMembership;
}

interface TenantAccessFailure {
  response: Response;
}

function securityLog(functionName: string, userId: string | null, requestedTenantId: string | null, allowed: boolean, reason?: string) {
  console.log(JSON.stringify({
    event: "tenant_access_check",
    function_name: functionName,
    user_id: userId,
    requested_tenant_id: requestedTenantId,
    allowed,
    reason: reason ?? null,
  }));
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function requireTenantAccess(
  options: RequireTenantAccessOptions,
): Promise<TenantAccessSuccess | TenantAccessFailure> {
  const { req, functionName, requestedTenantId } = options;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const token = getBearerToken(req);
  if (!token) {
    securityLog(functionName, null, requestedTenantId ?? null, false, "missing_token");
    return {
      response: new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }),
    };
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);

  if (authError || !authData.user) {
    securityLog(functionName, null, requestedTenantId ?? null, false, "invalid_token");
    return {
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }),
    };
  }

  const user = authData.user;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  let membershipQuery = supabaseAdmin
    .from("user_tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  if (requestedTenantId) {
    membershipQuery = membershipQuery.eq("tenant_id", requestedTenantId);
  }

  const { data: memberships, error: membershipError } = await membershipQuery;

  if (membershipError || !memberships || memberships.length === 0) {
    securityLog(functionName, user.id, requestedTenantId ?? null, false, "membership_not_found");
    return {
      response: new Response(JSON.stringify({ error: "Forbidden: no active membership for tenant" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }),
    };
  }

  const membership = memberships[0];
  const resolvedTenantId = requestedTenantId ?? membership.tenant_id;
  securityLog(functionName, user.id, resolvedTenantId, true);

  return {
    user,
    tenantId: resolvedTenantId,
    membership,
  };
}
