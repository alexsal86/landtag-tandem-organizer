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
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    // Get all tenants with sync settings enabled
    const { data: syncSettings, error: settingsError } = await supabase
      .from('calendar_sync_settings')
      .select('*')
      .eq('is_enabled', true);

    if (settingsError) {
      throw settingsError;
    }

    console.log(`Found ${syncSettings?.length || 0} tenants with enabled sync`);

    const results = [];

    for (const setting of syncSettings || []) {
      // Parse the sync time (format: HH:MM:SS)
      const [syncHour, syncMinute] = setting.sync_time.split(':').map(Number);
      
      // Calculate how many hours have passed since the sync time today
      let hoursSinceSync = currentHour - syncHour;
      
      // If we're before the sync time today, calculate from yesterday
      if (hoursSinceSync < 0) {
        hoursSinceSync += 24;
      }
      
      // Check if it's time to sync based on the interval
      const shouldSync = hoursSinceSync % setting.sync_interval_hours === 0 && currentMinutes < 5;
      
      if (!shouldSync) {
        console.log(`Skipping tenant ${setting.tenant_id} - not time yet (next sync in ${setting.sync_interval_hours - (hoursSinceSync % setting.sync_interval_hours)} hours)`);
        continue;
      }

      console.log(`Syncing calendars for tenant ${setting.tenant_id}`);

      // Get all active external calendars for this tenant
      const { data: calendars, error: calendarsError } = await supabase
        .from('external_calendars')
        .select('*')
        .eq('tenant_id', setting.tenant_id)
        .eq('is_active', true)
        .eq('sync_enabled', true);

      if (calendarsError) {
        console.error(`Error fetching calendars for tenant ${setting.tenant_id}:`, calendarsError);
        results.push({
          tenant_id: setting.tenant_id,
          status: 'error',
          error: calendarsError.message
        });
        continue;
      }

      console.log(`Found ${calendars?.length || 0} calendars for tenant ${setting.tenant_id}`);

      for (const calendar of calendars || []) {
        try {
          console.log(`Syncing calendar: ${calendar.name} (ID: ${calendar.id})`);

          // Call the sync function for this calendar
          const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-external-calendar', {
            body: { calendar_id: calendar.id }
          });

          if (syncError) {
            console.error(`Error syncing calendar ${calendar.name}:`, syncError);
            results.push({
              tenant_id: setting.tenant_id,
              calendar_id: calendar.id,
              calendar_name: calendar.name,
              status: 'error',
              error: syncError.message
            });
          } else {
            console.log(`Successfully synced calendar ${calendar.name}`);
            results.push({
              tenant_id: setting.tenant_id,
              calendar_id: calendar.id,
              calendar_name: calendar.name,
              status: 'success',
              synced_events: syncResult?.synced_events || 0
            });
          }
        } catch (error) {
          console.error(`Error processing calendar ${calendar.name}:`, error);
          results.push({
            tenant_id: setting.tenant_id,
            calendar_id: calendar.id,
            calendar_name: calendar.name,
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    console.log('Auto-sync completed:', results);

    return new Response(
      JSON.stringify({ 
        message: 'Auto-sync completed',
        results,
        processed_tenants: syncSettings?.length || 0,
        processed_calendars: results.length,
        timestamp: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-sync:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
