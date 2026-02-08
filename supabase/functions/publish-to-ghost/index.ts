import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Helper: hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Helper: Base64url encode
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper: string to Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Generate Ghost Admin API JWT
async function generateGhostJWT(adminApiKey: string): Promise<string> {
  const [keyId, keySecret] = adminApiKey.split(':');
  
  if (!keyId || !keySecret) {
    throw new Error('Invalid GHOST_ADMIN_API_KEY format. Expected format: {id}:{secret}');
  }

  const header = { alg: 'HS256', typ: 'JWT', kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 300, aud: '/admin/' };

  const encodedHeader = base64UrlEncode(stringToUint8Array(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(stringToUint8Array(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Import key from hex-decoded secret
  const secretBytes = hexToUint8Array(keySecret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    stringToUint8Array(signingInput)
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  return `${signingInput}.${encodedSignature}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const userId = claimsData.claims.sub;
    console.log(`[publish-to-ghost] Request from user: ${userId}`);

    // Get request body
    const { pressReleaseId } = await req.json();
    if (!pressReleaseId) {
      return new Response(JSON.stringify({ error: 'pressReleaseId is required' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`[publish-to-ghost] Publishing press release: ${pressReleaseId}`);

    // Load press release from DB
    const { data: pressRelease, error: prError } = await supabase
      .from('press_releases')
      .select('*')
      .eq('id', pressReleaseId)
      .single();

    if (prError || !pressRelease) {
      console.error('[publish-to-ghost] Press release not found:', prError);
      return new Response(JSON.stringify({ error: 'Press release not found' }), { 
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verify status is 'approved'
    if (pressRelease.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Press release must be approved before publishing' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get Ghost credentials
    const ghostAdminApiKey = Deno.env.get('GHOST_ADMIN_API_KEY');
    const ghostApiUrl = Deno.env.get('GHOST_API_URL');

    if (!ghostAdminApiKey || !ghostApiUrl) {
      console.error('[publish-to-ghost] Missing Ghost credentials');
      return new Response(JSON.stringify({ error: 'Ghost API credentials not configured' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Generate JWT for Ghost Admin API
    const ghostJwt = await generateGhostJWT(ghostAdminApiKey);
    console.log('[publish-to-ghost] Ghost JWT generated successfully');

    // Build Ghost post payload
    const ghostPayload = {
      posts: [{
        title: pressRelease.title,
        html: pressRelease.content_html || `<p>${pressRelease.content}</p>`,
        status: 'published',
        tags: pressRelease.tags?.map((t: string) => ({ name: t })) || [],
        excerpt: pressRelease.excerpt || undefined,
        feature_image: pressRelease.feature_image_url || undefined,
        meta_title: pressRelease.meta_title || undefined,
        meta_description: pressRelease.meta_description || undefined,
        slug: pressRelease.slug || undefined,
      }]
    };

    console.log('[publish-to-ghost] Sending to Ghost:', JSON.stringify({ title: pressRelease.title, tags: pressRelease.tags }));

    // Send to Ghost Admin API
    const ghostUrl = ghostApiUrl.replace(/\/$/, '');
    const ghostResponse = await fetch(
      `${ghostUrl}/ghost/api/admin/posts/?source=html`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Ghost ${ghostJwt}`,
          'Content-Type': 'application/json',
          'Accept-Version': 'v5.0'
        },
        body: JSON.stringify(ghostPayload)
      }
    );

    const ghostResult = await ghostResponse.json();

    if (!ghostResponse.ok) {
      console.error('[publish-to-ghost] Ghost API error:', JSON.stringify(ghostResult));
      return new Response(JSON.stringify({ 
        error: 'Ghost API error', 
        details: ghostResult.errors?.[0]?.message || 'Unknown error' 
      }), { 
        status: ghostResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const ghostPost = ghostResult.posts?.[0];
    console.log('[publish-to-ghost] Ghost post created:', ghostPost?.id, ghostPost?.url);

    // Update press release with Ghost post info using service role for reliability
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: updateError } = await serviceClient
      .from('press_releases')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        ghost_post_id: ghostPost?.id || null,
        ghost_post_url: ghostPost?.url || null,
      })
      .eq('id', pressReleaseId);

    if (updateError) {
      console.error('[publish-to-ghost] Failed to update press release status:', updateError);
      // Don't fail the request since Ghost post was created successfully
    }

    console.log('[publish-to-ghost] Successfully published press release');

    return new Response(JSON.stringify({ 
      success: true, 
      ghostPostId: ghostPost?.id,
      ghostPostUrl: ghostPost?.url 
    }), { 
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('[publish-to-ghost] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
