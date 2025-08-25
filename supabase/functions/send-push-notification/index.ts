import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Web Push utilities
async function urlBase64ToUint8Array(base64String: string): Promise<Uint8Array> {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function createVapidJWT(audience: string, subject: string, privateKeyPem: string): Promise<string> {
  try {
    // Create header
    const header = {
      alg: 'ES256',
      typ: 'JWT'
    };

    // Create payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      aud: audience,
      exp: now + (12 * 60 * 60), // 12 hours
      sub: subject
    };

    // Encode header and payload
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    // Create signing input
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Convert PEM to DER format for Web Crypto API
    let pemKey = privateKeyPem;
    
    // Remove PEM headers/footers and whitespace if present
    pemKey = pemKey.replace(/-----BEGIN PRIVATE KEY-----/g, '');
    pemKey = pemKey.replace(/-----END PRIVATE KEY-----/g, '');
    pemKey = pemKey.replace(/\s/g, '');
    
    // Decode base64 to get DER
    const binaryDer = atob(pemKey);
    const derBytes = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
      derBytes[i] = binaryDer.charCodeAt(i);
    }

    // Import private key
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      derBytes,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false,
      ['sign']
    );

    // Sign the JWT
    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256'
      },
      privateKey,
      new TextEncoder().encode(signingInput)
    );

    // Encode signature
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${signingInput}.${encodedSignature}`;
  } catch (error) {
    console.error('❌ Error creating VAPID JWT:', error);
    throw new Error(`Failed to create VAPID JWT: ${error.message}`);
  }
}

async function sendPushNotification(
  endpoint: string, 
  payload: string, 
  vapidPublicKey: string, 
  vapidPrivateKey: string, 
  vapidSubject: string
): Promise<Response> {
  try {
    console.log('🚀 Starting sendPushNotification...');
    console.log('📍 Endpoint:', endpoint.substring(0, 50) + '...');
    
    // Parse endpoint to get audience
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;
    console.log('🎯 Audience:', audience);

    // Create VAPID JWT
    console.log('🔐 Creating VAPID JWT...');
    const jwt = await createVapidJWT(audience, vapidSubject, vapidPrivateKey);
    console.log('✅ VAPID JWT created successfully');

    // Prepare headers
    const headers: Record<string, string> = {
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'Content-Type': 'application/octet-stream',
      'TTL': '86400'
    };

    console.log('📤 Sending push request...');
    // Send push notification
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: payload
    });
    
    console.log('📥 Push response received:', response.status);
    return response;
  } catch (error) {
    console.error('❌ Error in sendPushNotification:', error);
    throw error;
  }
}

console.log("Push notification function initialized");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting push notification function...');
    
    // Parse request
    const body = await req.json();
    console.log('📦 Request body:', body);

    // Initialize Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // For test requests, return success without actually sending push
    if (body.test || body.type === 'test') {
      console.log('✅ Test request - simulating successful push...');
      
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

        // For now, simulate success to test the UI flow
        console.log('🎭 Simulating successful push notification...');
        
        // Create a test notification in the database instead
        for (const subscription of subscriptions) {
          console.log(`📝 Creating test notification for user...`);
          
          // Get user_id from subscription
          const userId = subscription.user_id;
          
          if (userId) {
            // Create notification in database
            const { error: notificationError } = await supabaseAdmin
              .from('notifications')
              .insert({
                user_id: userId,
                notification_type_id: '380fab61-2f1a-40d1-bed8-d34925544397', // message_received type
                title: 'Push-Test erfolgreich! 🎉',
                message: 'Dies ist eine Test-Push-Benachrichtigung über die Datenbank.',
                data: { test: true, timestamp: new Date().toISOString() },
                priority: 'high'
              });
              
            if (notificationError) {
              console.error('❌ Error creating notification:', notificationError);
            } else {
              console.log('✅ Test notification created in database');
            }
          }
        }

        console.log('✅ Test complete: simulated success');

        return new Response(JSON.stringify({
          success: true,
          sent: subscriptions.length,
          failed: 0,
          total_subscriptions: subscriptions.length,
          message: `Test erfolgreich - ${subscriptions.length} Benachrichtigung(en) simuliert! (Check die Benachrichtigungsglocke oben rechts)`
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

    // Real push notifications implementation
    console.log('🔔 Processing real push notification...');
    console.log('📦 Request body for real push:', JSON.stringify(body, null, 2));
    
    // Get VAPID keys and subject from environment
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');

    console.log('🔑 VAPID config check:', {
      publicKeyExists: !!vapidPublicKey,
      privateKeyExists: !!vapidPrivateKey,
      subjectExists: !!vapidSubject,
      publicKeyLength: vapidPublicKey?.length || 0,
      privateKeyLength: vapidPrivateKey?.length || 0,
      subject: vapidSubject
    });

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error('❌ Missing VAPID configuration');
      return new Response(JSON.stringify({
        success: false,
        error: 'VAPID keys not configured',
        details: {
          publicKey: !!vapidPublicKey,
          privateKey: !!vapidPrivateKey,
          subject: !!vapidSubject
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get active push subscriptions
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

    console.log(`📋 Found ${subscriptions.length} active subscriptions`);

    // Prepare push notification payload
    const pushPayload = JSON.stringify({
      title: body.title || 'Neue Benachrichtigung',
      body: body.message || 'Sie haben eine neue Nachricht',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        ...body.data,
        timestamp: new Date().toISOString(),
        url: body.url || '/'
      },
      actions: [
        {
          action: 'view',
          title: 'Anzeigen'
        },
        {
          action: 'dismiss',
          title: 'Schließen'
        }
      ]
    });

    let sent = 0;
    let failed = 0;

    // Send push notifications to all subscriptions
    for (const subscription of subscriptions) {
      try {
        console.log(`📤 Sending push to subscription ${subscription.id}`);
        console.log(`🔗 Endpoint: ${subscription.endpoint}`);
        console.log(`📝 Payload: ${pushPayload.substring(0, 100)}...`);
        
        const response = await sendPushNotification(
          subscription.endpoint,
          pushPayload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );

        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Response headers:`, [...response.headers.entries()]);
        
        if (response.ok) {
          console.log(`✅ Push sent successfully to ${subscription.id}`);
          sent++;
          
          // Update push_sent_at timestamp
          await supabaseAdmin
            .from('push_subscriptions')
            .update({ 
              last_used: new Date().toISOString(),
              error_count: 0 
            })
            .eq('id', subscription.id);
            
        } else {
          console.error(`❌ Push failed for ${subscription.id}:`, response.status, await response.text());
          failed++;
          
          // Update error count
          await supabaseAdmin
            .from('push_subscriptions')
            .update({ 
              error_count: (subscription.error_count || 0) + 1,
              last_error: new Date().toISOString()
            })
            .eq('id', subscription.id);
            
          // Deactivate subscription after too many failures
          if ((subscription.error_count || 0) >= 5) {
            console.log(`🚫 Deactivating subscription ${subscription.id} due to too many failures`);
            await supabaseAdmin
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('id', subscription.id);
          }
        }
      } catch (error) {
        console.error(`❌ Error sending push to ${subscription.id}:`, error);
        failed++;
        
        // Update error count
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ 
            error_count: (subscription.error_count || 0) + 1,
            last_error: new Date().toISOString()
          })
          .eq('id', subscription.id);
      }
    }

    console.log(`✅ Push notification complete: ${sent} sent, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      sent,
      failed,
      total_subscriptions: subscriptions.length,
      message: `Push-Benachrichtigung gesendet: ${sent} erfolgreich, ${failed} fehlgeschlagen`
    }), {
      status: 200,
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