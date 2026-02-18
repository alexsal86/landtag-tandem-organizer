import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

console.log("Push notification function initialized (WebCrypto-based)");

// ── VAPID / WebPush helpers using Web Crypto API ──────────────────────
function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importVapidKeys(publicKeyB64: string, privateKeyB64: string) {
  const pubBytes = base64UrlDecode(publicKeyB64);
  // Public key is 65 bytes: 0x04 + x(32) + y(32)
  const x = base64UrlEncode(pubBytes.slice(1, 33));
  const y = base64UrlEncode(pubBytes.slice(33, 65));
  const d = privateKeyB64; // Already base64url

  const privateJwk = { kty: 'EC', crv: 'P-256', x, y, d, ext: true };
  
  const privateKey = await crypto.subtle.importKey(
    'jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  
  return privateKey;
}

async function createVapidAuthHeader(
  audience: string, 
  subject: string, 
  publicKeyB64: string, 
  privateKey: CryptoKey
): Promise<{ authorization: string; cryptoKey: string }> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600, // 12 hours
    sub: subject,
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format (if needed)
  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;
  
  if (sigBytes.length === 64) {
    rawSig = sigBytes;
  } else {
    // DER encoded — parse r and s
    rawSig = derToRaw(sigBytes);
  }

  const signatureB64 = base64UrlEncode(rawSig);
  const jwt = `${unsignedToken}.${signatureB64}`;

  return {
    authorization: `vapid t=${jwt}, k=${publicKeyB64}`,
    cryptoKey: `p256ecdsa=${publicKeyB64}`,
  };
}

function derToRaw(der: Uint8Array): Uint8Array {
  // Parse DER SEQUENCE containing two INTEGERs
  const raw = new Uint8Array(64);
  let offset = 2; // skip SEQUENCE tag + length
  
  // Parse r
  if (der[offset] !== 0x02) throw new Error('Expected INTEGER tag');
  offset++;
  const rLen = der[offset]; offset++;
  const rStart = offset + (rLen > 32 ? rLen - 32 : 0);
  const rDest = 32 - Math.min(rLen, 32);
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;
  
  // Parse s
  if (der[offset] !== 0x02) throw new Error('Expected INTEGER tag');
  offset++;
  const sLen = der[offset]; offset++;
  const sStart = offset + (sLen > 32 ? sLen - 32 : 0);
  const sDest = 32 + 32 - Math.min(sLen, 32);
  raw.set(der.slice(sStart, offset + sLen), sDest);
  
  return raw;
}

// RFC 8291 content encryption
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ body: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const payloadBytes = new TextEncoder().encode(payload);
  
  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  
  // Export local public key as raw
  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey)
  );
  
  // Import subscriber's p256dh key
  const subscriberPubBytes = base64ToUint8Array(p256dhKey);
  const subscriberPubKey = await crypto.subtle.importKey(
    'raw',
    subscriberPubBytes.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  
  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberPubKey },
      localKeyPair.privateKey,
      256
    )
  );
  
  // Auth secret
  const authSecretBytes = base64ToUint8Array(authSecret);
  
  // Generate 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // HKDF for IKM (info = "WebPush: info\0" + recipient_pub + sender_pub)
  const infoIkm = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\0'),
    ...subscriberPubBytes,
    ...localPublicKeyRaw,
  ]);
  
  const ikmKey = await crypto.subtle.importKey(
    'raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits']
  );
  
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: authSecretBytes.buffer as ArrayBuffer, info: infoIkm },
      ikmKey,
      256
    )
  );
  
  // PRK from salt and IKM
  const prkKey = await crypto.subtle.importKey(
    'raw', ikm, { name: 'HKDF' }, false, ['deriveBits']
  );
  
  // Content encryption key (CEK)
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const cek = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
      prkKey,
      128
    )
  );
  
  // Nonce
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
      prkKey,
      96
    )
  );
  
  // Pad payload (add delimiter byte 0x02 + no padding)
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // delimiter
  
  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey(
    'raw', cek, { name: 'AES-GCM' }, false, ['encrypt']
  );
  
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      paddedPayload
    )
  );
  
  // Build aes128gcm body: salt(16) + rs(4) + idlen(1) + keyid(65) + encrypted
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  
  const body = new Uint8Array(
    16 + 4 + 1 + localPublicKeyRaw.length + encrypted.length
  );
  let offset = 0;
  body.set(salt, offset); offset += 16;
  body.set(recordSize, offset); offset += 4;
  body[offset] = localPublicKeyRaw.length; offset += 1;
  body.set(localPublicKeyRaw, offset); offset += localPublicKeyRaw.length;
  body.set(encrypted, offset);
  
  return { body, salt, localPublicKey: localPublicKeyRaw };
}

function base64ToUint8Array(base64: string): Uint8Array {
  // Handle both standard and URL-safe base64
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh_key: string; auth_key: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: CryptoKey,
  vapidSubject: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    // Parse endpoint URL to get audience
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    
    // Create VAPID auth header
    const vapidHeaders = await createVapidAuthHeader(
      audience, vapidSubject, vapidPublicKey, vapidPrivateKey
    );
    
    // Encrypt payload
    const encrypted = await encryptPayload(
      payload, subscription.p256dh_key, subscription.auth_key
    );
    
    // Send to push service
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': vapidHeaders.authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        'Urgency': 'normal',
      },
      body: encrypted.body as unknown as BodyInit,
    });
    
    if (response.status === 201 || response.status === 200) {
      return { success: true, status: response.status };
    } else {
      const text = await response.text();
      return { success: false, status: response.status, error: text };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Main handler ──────────────────────────────────────────────────────
serve(async (req) => {
  console.log('🚀 Function called with method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET: Return VAPID public key
  if (req.method === 'GET') {
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    if (!vapidPublicKey) {
      return new Response(JSON.stringify({ success: false, error: 'VAPID public key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ success: true, publicKey: vapidPublicKey }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    console.log('📦 Request:', JSON.stringify({ 
      user_id: body.user_id, title: body.title, 
      from_trigger: body.from_trigger, test: body.test 
    }));

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const isTestRequest = body.test || body.type === 'test';
    const isFromTrigger = body.from_trigger === true;
    const targetUserId = body.user_id || null;

    // ── TEST REQUEST ────────────────────────────────────────────────
    if (isTestRequest) {
      console.log('🧪 Processing TEST request...');
      
      const { data: subscriptions, error } = await supabaseAdmin
        .from('push_subscriptions').select('*').eq('is_active', true);

      if (error || !subscriptions?.length) {
        return new Response(JSON.stringify({
          success: false, sent: 0, failed: 0, total_subscriptions: 0,
          message: error ? error.message : 'No active push subscriptions found'
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      for (const sub of subscriptions) {
        if (sub.user_id) {
          await supabaseAdmin.from('notifications').insert({
            user_id: sub.user_id,
            notification_type_id: '380fab61-2f1a-40d1-bed8-d34925544397',
            title: 'Push-Test erfolgreich! 🎉',
            message: 'Dies ist eine Test-Push-Benachrichtigung.',
            data: { test: true, timestamp: new Date().toISOString() },
            priority: 'high'
          });
        }
      }

      return new Response(JSON.stringify({
        success: true, sent: subscriptions.length, failed: 0,
        total_subscriptions: subscriptions.length,
        message: `Test erfolgreich - ${subscriptions.length} Benachrichtigung(en) simuliert!`
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── REAL PUSH ───────────────────────────────────────────────────
    console.log('🔔 Processing REAL push notification...');

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKeyB64 = Deno.env.get('VAPID_PRIVATE_KEY');
    let vapidSubject = Deno.env.get('VAPID_SUBJECT');
    
    if (vapidSubject && !vapidSubject.startsWith('mailto:') && !vapidSubject.startsWith('http')) {
      vapidSubject = `mailto:${vapidSubject}`;
    }
    
    if (!vapidPublicKey || !vapidPrivateKeyB64 || !vapidSubject) {
      console.error('❌ Missing VAPID configuration');
      return new Response(JSON.stringify({ success: false, error: 'VAPID configuration missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Import VAPID private key
    const vapidPrivateKey = await importVapidKeys(vapidPublicKey, vapidPrivateKeyB64);
    console.log('✅ VAPID keys imported via WebCrypto');
    
    // Query subscriptions (filter by user if specified)
    let query = supabaseAdmin
      .from('push_subscriptions').select('*').eq('is_active', true);
    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
      console.log(`🎯 Filtering for user: ${targetUserId}`);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error('❌ DB error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!subscriptions?.length) {
      console.log(`📋 No active subscriptions found for user: ${targetUserId || 'ALL'}. ${isFromTrigger ? '(triggered by DB insert — user likely has not enabled push notifications in settings)' : ''}`);
      return new Response(JSON.stringify({
        success: true, sent: 0, failed: 0, total_subscriptions: 0,
        message: `No active push subscriptions found${targetUserId ? ` for user ${targetUserId}` : ''}`
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📋 Found ${subscriptions.length} subscriptions`);
    
    const notificationPayload = JSON.stringify({
      title: body.title || 'Neue Benachrichtigung 🔔',
      body: body.message || 'Sie haben eine neue Benachrichtigung erhalten.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: body.data || { timestamp: new Date().toISOString() },
      actions: [{ action: 'open', title: 'Öffnen' }],
      requireInteraction: false,
      silent: false
    });
    
    let sentCount = 0;
    let failedCount = 0;
    
    for (const sub of subscriptions) {
      console.log(`📤 Sending to user ${sub.user_id}...`);
      
      const result = await sendWebPush(
        sub, notificationPayload, vapidPublicKey, vapidPrivateKey, vapidSubject
      );
      
      if (result.success) {
        sentCount++;
        console.log(`✅ Push sent (status ${result.status})`);
        
        // Only create DB notification if NOT from trigger (avoid loop)
        if (!isFromTrigger && sub.user_id) {
          await supabaseAdmin.from('notifications').insert({
            user_id: sub.user_id,
            notification_type_id: '380fab61-2f1a-40d1-bed8-d34925544397',
            title: body.title || 'Push Notification 🔔',
            message: body.message || 'Browser-Push gesendet.',
            data: { ...body.data, pushed: true },
            priority: body.priority || 'medium'
          });
        }
      } else {
        failedCount++;
        console.error(`❌ Push failed (status ${result.status}): ${result.error}`);
        
        // Deactivate invalid subscriptions
        if (result.status === 410 || result.status === 404) {
          console.log(`🗑️ Marking subscription inactive`);
          await supabaseAdmin
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', sub.id);
        }
      }
    }
    
    console.log(`📊 Results: ${sentCount} sent, ${failedCount} failed`);
    
    return new Response(JSON.stringify({
      success: true, sent: sentCount, failed: failedCount,
      total_subscriptions: subscriptions.length,
      message: `${sentCount} Push gesendet, ${failedCount} fehlgeschlagen.`
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      sent: 0, failed: 0, total_subscriptions: 0
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
