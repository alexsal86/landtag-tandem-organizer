import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("=== MINIMAL PUSH FUNCTION STARTED ===");

serve(async (req) => {
  console.log('=== REQUEST RECEIVED ===', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('=== RETURNING CORS ===');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== PROCESSING REQUEST ===');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Minimal function is working!',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== ERROR ===', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});