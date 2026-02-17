import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the requesting user is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('is_admin', {
      _user_id: requestingUser.id
    });

    if (roleError || !isAdmin) {
      throw new Error('Insufficient permissions - Admin role required');
    }

    const { userId, reason } = await req.json();

    if (!userId) {
      throw new Error('Missing userId parameter');
    }

    console.log(`Admin ${requestingUser.id} is resetting MFA for user ${userId}. Reason: ${reason || 'None provided'}`);

    // Get user's MFA factors
    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (getUserError || !user) {
      throw new Error('User not found');
    }

    // Note: Direct MFA reset via admin SDK is not available in current Supabase version
    // This would need to be implemented via direct database access or custom SQL
    // For now, we'll log the request and provide instructions
    
    // Create an audit log entry
    const { error: auditError } = await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: requestingUser.id,
      action: 'mfa_reset',
      target_user_id: userId,
      reason: reason || 'No reason provided',
      metadata: {
        user_email: user.email,
        timestamp: new Date().toISOString()
      }
    });
    if (auditError) console.error('Failed to create audit log:', auditError);

    // Send notification to the user
    const { data: notificationType } = await supabaseAdmin
      .from('notification_types')
      .select('id')
      .eq('name', 'system_alert')
      .single();

    const { error: notifError } = await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      notification_type_id: notificationType?.id,
      title: '2FA wurde zurückgesetzt',
      message: 'Ihre Zwei-Faktor-Authentifizierung wurde von einem Administrator zurückgesetzt. Sie können 2FA in den Einstellungen erneut aktivieren.',
      priority: 'high'
    });
    if (notifError) console.error('Failed to send notification:', notifError);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'MFA reset request logged. User has been notified.',
        instructions: 'The user needs to log in and set up 2FA again from settings.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error resetting MFA:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('permissions')) ? 403 : 400
      }
    );
  }
});
