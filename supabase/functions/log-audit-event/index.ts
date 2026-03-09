import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  requireAuth,
  unauthorizedResponse,
  safeErrorResponse,
  withSafeHandler,
} from "../_shared/security.ts";

Deno.serve(withSafeHandler("log-audit-event", async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Auth guard – audit events require an authenticated user
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();

  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown';

  const userAgent = req.headers.get('user-agent') || 'unknown';

  const body = await req.json();
  const { action, details, email } = body;

  if (!action) {
    return new Response(
      JSON.stringify({ error: 'Action is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const payload = {
    action,
    details: details || {},
    email: email || null,
    user_agent: userAgent,
    timestamp: new Date().toISOString(),
  };

  console.log(`📝 Logging audit event: ${action} for user ${auth.userId} from IP ${ipAddress}`);

  const { error: insertError } = await supabase
    .from('audit_log_entries')
    .insert({
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

  console.log(`✅ Audit event logged successfully: ${action}`);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}));
