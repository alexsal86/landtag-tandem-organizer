import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting schedule-auto-archive function');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the auto-archive-letters function
    const { data, error } = await supabase.functions.invoke('auto-archive-letters', {
      body: {}
    });

    if (error) {
      console.error('Error calling auto-archive-letters:', error);
      throw error;
    }

    console.log('Auto-archive scheduled successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Auto-archive function called successfully',
        result: data
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in schedule-auto-archive function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to schedule auto-archive',
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});