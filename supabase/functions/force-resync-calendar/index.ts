import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting force calendar re-sync');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { calendar_id, clear_existing = false } = await req.json();

    if (!calendar_id) {
      return new Response(
        JSON.stringify({ error: 'calendar_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📅 Force re-sync for calendar: ${calendar_id}`);
    console.log(`🗑️ Clear existing events: ${clear_existing}`);

    // If requested, clear existing events
    if (clear_existing) {
      console.log('🗑️ Deleting existing events...');
      const { error: deleteError } = await supabase
        .from('external_events')
        .delete()
        .eq('external_calendar_id', calendar_id);

      if (deleteError) {
        throw new Error(`Failed to delete existing events: ${deleteError.message}`);
      }
      console.log('✅ Existing events cleared');
    }

    // Reset sync timestamps to force full re-sync
    console.log('🔄 Resetting sync timestamps...');
    const { error: resetError } = await supabase
      .from('external_calendars')
      .update({
        last_sync: null,
        last_successful_sync: null,
        sync_errors_count: 0,
        last_sync_error: null
      })
      .eq('id', calendar_id);

    if (resetError) {
      throw new Error(`Failed to reset sync timestamps: ${resetError.message}`);
    }

    console.log('✅ Sync timestamps reset');

    // Trigger the sync function
    console.log('🚀 Triggering sync function...');
    const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-external-calendar', {
      body: { calendar_id }
    });

    if (syncError) {
      throw new Error(`Sync function failed: ${syncError.message}`);
    }

    console.log('🎉 Force re-sync completed successfully!');
    console.log('📊 Sync result:', syncResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Force re-sync completed successfully',
        syncResult,
        clearedExisting: clear_existing
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Force re-sync error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});