import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  requireAuth,
  unauthorizedResponse,
  withSafeHandler,
} from "../_shared/security.ts";
import { resolveTenantMembership } from "../_shared/tenant-policy.ts";

const ACTION_PATTERN = /^[A-Za-z0-9_.:-]{1,80}$/;

function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown';
}

/**
 * Ordnet den Eintrag einem Büro zu, damit die SELECT-Policy ihn sichtbar macht.
 * Die Auswahl folgt der gemeinsamen Mandantenregel: ein ausdrücklich genanntes
 * Büro zählt nur bei aktiver Mitgliedschaft, mehrere Büros ohne Angabe bleiben
 * mandantenfrei (nur Plattformadministration sichtbar) statt zu raten.
 */
async function resolveTenantId(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requested: unknown,
): Promise<string | null> {
  const { data } = await admin
    .from('user_tenant_memberships')
    .select('tenant_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(20);
  const membership = resolveTenantMembership(
    (data ?? []) as { tenant_id: string; role: string | null }[],
    typeof requested === 'string' ? requested : null,
  );
  return membership?.tenant_id ?? null;
}

Deno.serve(withSafeHandler("log-audit-event", async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Auth guard – audit events require an authenticated user
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();

  const ipAddress = clientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  const body = await req.json();
  const { action, details, email, tenant_id: requestedTenantId } = body;

  if (!action) {
    return new Response(
      JSON.stringify({ error: 'Action is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (typeof action !== 'string' || !ACTION_PATTERN.test(action)) {
    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const tenantId = await resolveTenantId(supabase, auth.userId, requestedTenantId);

  const payload = {
    action,
    details: details || {},
    email: email || null,
    user_agent: userAgent,
    timestamp: new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from('audit_log_entries')
    .insert({
      action,
      tenant_id: tenantId,
      user_id: auth.userId,
      ip_address: ipAddress,
      payload,
    });

  if (insertError) {
    console.error('Error inserting audit log:', insertError);
    return new Response(
      JSON.stringify({ error: 'Failed to log event' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}));
