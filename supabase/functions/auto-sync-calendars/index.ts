import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

import { getCorsHeaders, withSafeHandler, requireServiceRole, forbiddenResponse } from "../_shared/security.ts";


serve(withSafeHandler("auto-sync-calendars", async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!requireServiceRole(req)) return forbiddenResponse("Service role required");

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting automatic calendar sync...');

    const now = new Date();

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
      const { data: slot, error: claimError } = await supabase.rpc('claim_calendar_sync', { _setting_id: setting.id });
      if (claimError) throw claimError;
      if (!slot) continue;
      let success = true;

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
        await supabase.rpc('finish_calendar_sync', { _setting_id: setting.id, _slot: slot, _success: false });
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

          if (syncError || syncResult?.status === "error") {
            success = false;
            console.error(`Error syncing calendar ${calendar.name}:`, syncError);
            results.push({
              tenant_id: setting.tenant_id,
              calendar_id: calendar.id,
              calendar_name: calendar.name,
              status: 'error',
              error: syncError?.message ?? "Sync failed"
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
          success = false;
          console.error(`Error processing calendar ${calendar.name}:`, error);
          results.push({
            tenant_id: setting.tenant_id,
            calendar_id: calendar.id,
            calendar_name: calendar.name,
            status: 'error',
            error: "Sync failed"
          });
        }
      }
      const { error: finishError } = await supabase.rpc('finish_calendar_sync', {
        _setting_id: setting.id, _slot: slot, _success: success,
      });
      if (finishError) throw finishError;
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
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
