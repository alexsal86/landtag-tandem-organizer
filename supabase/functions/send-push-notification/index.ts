import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Push notification function initialized");

// VAPID JWT creation using Web Crypto API
async function createVapidJWT(subject: string, audience: string, privateKeyBase64: string): Promise<string> {
  console.log('🔐 Creating VAPID JWT...');
  
  const now = Math.floor(Date.now() / 1000);
  
  // JWT Header
  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };
  
  // JWT Payload
  const payload = {
    aud: new URL(audience).origin,
    exp: now + (12 * 60 * 60), // 12 hours
    sub: subject
  };
  
  // Encode header and payload
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  
  try {
    // Convert base64url private key to bytes
    const privateKeyBytes = base64urlDecode(privateKeyBase64);
    
    // Import the private key
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBytes,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false,
      ['sign']
    );
    
    // Sign the token
    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      privateKey,
      new TextEncoder().encode(unsignedToken)
    );
    
    const encodedSignature = base64urlEncode(new Uint8Array(signature));
    const jwt = `${unsignedToken}.${encodedSignature}`;
    
    console.log('✅ VAPID JWT created successfully');
    return jwt;
  } catch (error) {
    console.error('❌ Error creating VAPID JWT:', error);
    throw new Error('Failed to create VAPID JWT: ' + error.message);
  }
}

// Base64URL encoding/decoding helpers
function base64urlEncode(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(base64url: string): Uint8Array {
  // Add padding if needed
  const padding = '='.repeat((4 - base64url.length % 4) % 4);
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting push notification function...');
    
    // Get VAPID keys
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY_FRESH') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY_FRESH') || '';
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:mail@alexander-salomon.de';
    
    console.log('🔑 VAPID Keys Check:', {
      publicKeyExists: !!vapidPublicKey,
      privateKeyExists: !!vapidPrivateKey,
      publicKeyLength: vapidPublicKey.length,
      privateKeyLength: vapidPrivateKey.length,
      subject: vapidSubject
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

    // For test requests
    if (body.test || body.type === 'test') {
      console.log('✅ Test request - sending push notifications...');
      
      try {
        // Get all active push subscriptions
        const { data: subscriptions, error } = await supabaseAdmin
          .from('push_subscriptions')
          .select('*')
          .eq('is_active', true);

        if (error) {
          console.error('❌ Database error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Database error: ' + error.message
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
            message: 'No active push subscriptions found'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Send notifications with proper VAPID authentication
        let sent = 0;
        let failed = 0;

        for (const subscription of subscriptions) {
          try {
            console.log(`📤 Sending push to subscription ${subscription.id}`);
            
            // Create VAPID JWT for this endpoint
            const vapidJWT = await createVapidJWT(vapidSubject, subscription.endpoint, vapidPrivateKey);
            
            // Prepare the notification payload
            const notificationPayload = {
              title: body.title || 'Test-Benachrichtigung',
              body: body.message || 'Dies ist eine Test-Push-Benachrichtigung!',
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              data: body.data || {}
            };

            // Send push notification with proper VAPID headers
            const response = await fetch(subscription.endpoint, {
              method: 'POST',
              headers: {
                'Authorization': `vapid t=${vapidJWT}, k=${vapidPublicKey}`,
                'Content-Type': 'application/json',
                'TTL': '2419200'
              },
              body: JSON.stringify(notificationPayload)
            });

            console.log(`📊 Response status: ${response.status}`);

            if (response.ok || response.status === 201) {
              sent++;
              console.log(`✅ Push sent successfully to subscription ${subscription.id}`);
            } else {
              failed++;
              const responseText = await response.text().catch(() => 'Unable to read response');
              console.log(`❌ Push failed to subscription ${subscription.id}: ${response.status} - ${responseText}`);
              
              // Deactivate invalid subscriptions
              if (response.status === 410 || response.status === 404) {
                await supabaseAdmin
                  .from('push_subscriptions')
                  .update({ is_active: false })
                  .eq('id', subscription.id);
                console.log(`🗑️ Deactivated invalid subscription ${subscription.id}`);
              }
            }
          } catch (pushError) {
            failed++;
            console.error(`❌ Push error for subscription ${subscription.id}:`, pushError);
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

      } catch (dbError) {
        console.error('❌ Database connection error:', dbError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Database connection failed: ' + dbError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // For real notifications, return not implemented for now
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
      error: 'Function error: ' + error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});