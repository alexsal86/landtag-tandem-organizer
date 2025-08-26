import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting automatic calendar sync...');

    // Get all active external calendars that need syncing
    const { data: calendars, error: calendarsError } = await supabase
      .from('external_calendars')
      .select('*')
      .eq('is_active', true)
      .eq('sync_enabled', true);

    if (calendarsError) {
      throw calendarsError;
    }

    console.log(`Found ${calendars?.length || 0} calendars to sync`);

    const results = [];
    const now = new Date();

    for (const calendar of calendars || []) {
      try {
        // Check if sync is needed based on interval
        const lastSync = calendar.last_sync ? new Date(calendar.last_sync) : null;
        const syncIntervalMs = calendar.sync_interval * 60 * 1000; // Convert minutes to milliseconds
        
        if (lastSync && (now.getTime() - lastSync.getTime()) < syncIntervalMs) {
          console.log(`Skipping calendar ${calendar.name} - sync not yet due`);
          continue;
        }

        console.log(`Syncing calendar: ${calendar.name}`);

        // Call the sync function for this calendar
        const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-external-calendar', {
          body: { calendar_id: calendar.id }
        });

        if (syncError) {
          console.error(`Error syncing calendar ${calendar.name}:`, syncError);
          results.push({
            calendar_id: calendar.id,
            calendar_name: calendar.name,
            status: 'error',
            error: syncError.message
          });
        } else {
          console.log(`Successfully synced calendar ${calendar.name}`);
          results.push({
            calendar_id: calendar.id,
            calendar_name: calendar.name,
            status: 'success',
            synced_events: syncResult?.synced_events || 0
          });
        }
      } catch (error) {
        console.error(`Error processing calendar ${calendar.name}:`, error);
        results.push({
          calendar_id: calendar.id,
          calendar_name: calendar.name,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log('Auto-sync completed:', results);

    return new Response(
      JSON.stringify({ 
        message: 'Auto-sync completed',
        results,
        processed_calendars: results.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-sync:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});