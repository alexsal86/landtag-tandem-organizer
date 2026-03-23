import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

import { withSafeHandler } from "../_shared/security.ts";
console.log("Push notification worker initialized");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(withSafeHandler("push-notification-worker", async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('📋 Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔗 Initializing Supabase...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get notification data from request
    const requestData = await req.json();
    console.log('📦 Received notification request:', requestData);

    const { user_id, title, message, priority = 'medium', data = {} } = requestData;

    if (!user_id || !title || !message) {
      throw new Error('Missing required fields: user_id, title, message');
    }

    // Call the existing push notification function
    console.log('🔔 Calling send-push-notification function...');
    const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id,
        title,
        message,
        priority,
        data
      }
    });

    if (pushError) {
      console.error('❌ Push notification error:', pushError);
      throw pushError;
    }

    console.log('✅ Push notification sent successfully:', pushResult);

    return new Response(JSON.stringify({
      success: true,
      message: 'Push notification sent successfully',
      result: pushResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in push notification worker:', error);
    return new Response(JSON.stringify({
      error: { code: 'internal_error', message: 'Internal server error' },
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));
