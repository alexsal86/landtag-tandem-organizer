import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to encode data using Base64URL
function base64UrlEncode(buffer: ArrayBuffer): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Generate VAPID JWT for authentication
async function generateVapidJWT(audience: string, subject: string, publicKey: string, privateKey: string): Promise<string> {
  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };

  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
    sub: subject
  };

  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const privateKeyBuffer = Uint8Array.from(atob(privateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = base64UrlEncode(signature);
  return `${unsignedToken}.${encodedSignature}`;
}

// Send push notification to a specific subscription
async function sendWebPushNotification(
  subscription: any,
  payload: string,
  vapidJWT: string,
  vapidPublicKey: string
): Promise<boolean> {
  try {
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': `vapid t=${vapidJWT}, k=${vapidPublicKey}`,
        'TTL': '2419200'
      },
      body: payload,
    });

    console.log(`📤 Push response for ${subscription.endpoint}: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error(`❌ Push failed for ${subscription.endpoint}:`, error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting push notification function...');
    
    // Get VAPID configuration
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY_FRESH') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY_FRESH') || '';
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:mail@alexander-salomon.de';
    
    console.log('🔑 VAPID Keys Check:', {
      publicKeyExists: !!vapidPublicKey,
      privateKeyExists: !!vapidPrivateKey,
      publicKeyLength: vapidPublicKey.length,
      privateKeyLength: vapidPrivateKey.length
    });

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('❌ VAPID keys missing!');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'VAPID keys not configured'
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const body = await req.json();
    console.log('📦 Request body:', body);

    // Initialize Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle test notifications
    if (body.test || body.type === 'test') {
      console.log('🧪 Processing test notification...');
      
      // Get all active push subscriptions
      const { data: subscriptions, error } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('❌ Error fetching subscriptions:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Database error',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`📋 Found ${subscriptions?.length || 0} active subscriptions`);

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          sent: 0,
          failed: 0,
          total_subscriptions: 0,
          error: 'No active push subscriptions found'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate VAPID JWT
      const audience = new URL(subscriptions[0].endpoint).origin;
      const vapidJWT = await generateVapidJWT(audience, vapidSubject, vapidPublicKey, vapidPrivateKey);

      // Prepare test payload
      const testPayload = JSON.stringify({
        title: 'Test-Benachrichtigung',
        body: 'Dies ist eine Test-Push-Benachrichtigung!',
        icon: '/favicon.ico',
        tag: 'test-notification'
      });

      let sent = 0;
      let failed = 0;

      // Send to all subscriptions
      for (const subscription of subscriptions) {
        const success = await sendWebPushNotification(
          subscription,
          testPayload,
          vapidJWT,
          vapidPublicKey
        );

        if (success) {
          sent++;
        } else {
          failed++;
          // Deactivate failed subscription
          await supabaseAdmin
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', subscription.id);
        }
      }

      console.log(`✅ Test complete: ${sent} sent, ${failed} failed`);

      return new Response(JSON.stringify({
        success: sent > 0,
        sent,
        failed,
        total_subscriptions: subscriptions.length,
        message: sent > 0 ? 'Test notifications sent successfully!' : 'No notifications could be sent'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle real notifications (placeholder for now)
    return new Response(JSON.stringify({
      success: false,
      error: 'Real push notifications not implemented yet'
    }), {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});