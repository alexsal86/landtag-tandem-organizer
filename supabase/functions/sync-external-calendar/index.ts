// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { parseICS, type ICSEvent } from './sync-external-calendar.utils.ts'

import { withSafeHandler, requireAuth, requireServiceRole, unauthorizedResponse } from "../_shared/security.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncStats {
  totalParsed: number;
  newEvents: number;
  updatedEvents: number;
  skippedEvents: number;
  errorEvents: number;
  deletedEvents: number;
}

async function incrementalSync(supabase: any, calendarId: string, newEvents: ICSEvent[]): Promise<SyncStats> {
  const stats: SyncStats = {
    totalParsed: newEvents.length,
    newEvents: 0,
    updatedEvents: 0,
    skippedEvents: 0,
    errorEvents: 0,
    deletedEvents: 0
  };

  // Vorhandene Events inkl. gespeicherter Zeiten laden (für Abgleich/Heilung)
  const { data: existingEvents, error: existingError } = await supabase
    .from('external_events')
    .select('external_uid, last_modified, start_time, end_time, all_day')
    .eq('external_calendar_id', calendarId);

  if (existingError) {
    console.error('❌ Error fetching existing events:', existingError);
    throw new Error(`Failed to fetch existing events: ${existingError.message}`);
  }

  // Create a map of existing events for quick lookup
  type ExistingExternalEvent = {
    external_uid: string;
    last_modified: string | null;
    start_time: string | null;
    end_time: string | null;
    all_day: boolean | null;
  };
  const existingEventsMap = new Map<string, ExistingExternalEvent>();
  if (existingEvents) {
    existingEvents.forEach((event: ExistingExternalEvent) => {
      existingEventsMap.set(event.external_uid, event);
    });
  }

  // Process new events in batches for UPSERT
  const batchSize = 25; // Smaller batches for better reliability
  const eventsToProcess = [];

  for (const event of newEvents) {
    // Beim Parsen bereits mit Z/TZID/VTIMEZONE aufgelöste UTC-Zeitstempel.
    const startTime = new Date(event.startUtc);
    const endTime = new Date(event.endUtc);

    const eventData = {
      external_calendar_id: calendarId,
      external_uid: event.uid,
      title: event.summary,
      description: event.description || null,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      location: event.location || null,
      all_day: event.allDay || false,
      recurrence_rule: event.rrule || null,
      raw_ics_data: event,
      last_modified: event.lastModifiedUtc ?? new Date().toISOString(),
    };

    // Vorhandenen Datensatz prüfen. Zeit- oder Ganztagsabweichungen werden auch
    // ohne neues LAST-MODIFIED korrigiert, damit früher falsch verschobene
    // Importe beim nächsten Sync geradegerückt werden.
    const existing = existingEventsMap.get(event.uid);
    const timesDiffer = existing !== undefined && (
      Date.parse(existing.start_time ?? '') !== startTime.getTime() ||
      Date.parse(existing.end_time ?? '') !== endTime.getTime() ||
      Boolean(existing.all_day) !== Boolean(event.allDay)
    );

    if (!existing) {
      // New event
      eventsToProcess.push({ ...eventData, action: 'new' });
    } else if (timesDiffer) {
      eventsToProcess.push({ ...eventData, action: 'update' });
    } else if (event.lastModifiedUtc) {
      const existingDate = new Date(existing.last_modified ?? 0);

      if (new Date(event.lastModifiedUtc) > existingDate) {
        // Event was modified
        eventsToProcess.push({ ...eventData, action: 'update' });
      } else {
        // Event unchanged
        stats.skippedEvents++;
      }
    } else {
      // No last-modified info, assume it needs update
      eventsToProcess.push({ ...eventData, action: 'update' });
    }
  }

  // Remove duplicate UIDs within the batch to prevent database conflicts
  const uniqueEventsMap = new Map();
  eventsToProcess.forEach(event => {
    const existingEvent = uniqueEventsMap.get(event.external_uid);
    if (!existingEvent || (event.last_modified && (!existingEvent.last_modified || event.last_modified > existingEvent.last_modified))) {
      uniqueEventsMap.set(event.external_uid, event);
    }
  });

  const dedupedEvents = Array.from(uniqueEventsMap.values());
  const duplicatesRemoved = eventsToProcess.length - dedupedEvents.length;

  // Process events in batches using UPSERT
  for (let i = 0; i < dedupedEvents.length; i += batchSize) {
    const batch = dedupedEvents.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(dedupedEvents.length / batchSize);

    try {

      // UPSERT using ON CONFLICT - process each event individually to avoid batch conflicts
      let batchNewCount = 0;
      let batchUpdateCount = 0;
      let batchErrorCount = 0;

      for (const eventItem of batch) {
        try {
          const { action, ...eventData } = eventItem;

          const { error: upsertError } = await supabase
            .from('external_events')
            .upsert(
              [eventData],
              {
                onConflict: 'external_calendar_id,external_uid',
                ignoreDuplicates: false
              }
            );

          if (upsertError) {
            console.error(`❌ Error upserting event ${eventData.external_uid}:`, {
              error: upsertError,
              uid: eventData.external_uid,
              title: eventData.title
            });
            batchErrorCount++;
          } else {
            if (action === 'new') {
              batchNewCount++;
            } else {
              batchUpdateCount++;
            }
          }
        } catch (eventError) {
          console.error(`❌ Failed to process individual event:`, {
            error: eventError,
            uid: eventItem.external_uid,
            title: eventItem.title
          });
          batchErrorCount++;
        }
      }

      // Update stats
      stats.newEvents += batchNewCount;
      stats.updatedEvents += batchUpdateCount;
      stats.errorEvents += batchErrorCount;

    } catch (error) {
      console.error(`❌ Batch ${batchNumber} failed completely:`, error);
      stats.errorEvents += batch.length;
    }
  }

  // Identify and remove deleted events (events that exist in DB but not in new ICS)
  const newEventUids = new Set(newEvents.map(e => e.uid));
  const deletedUids = [];

  for (const [uid, _] of existingEventsMap) {
    if (!newEventUids.has(uid)) {
      deletedUids.push(uid);
    }
  }

  if (deletedUids.length > 0) {

    const { error: deleteError } = await supabase
      .from('external_events')
      .delete()
      .eq('external_calendar_id', calendarId)
      .in('external_uid', deletedUids);

    if (deleteError) {
      console.error('❌ Error deleting removed events:', deleteError);
    } else {
      stats.deletedEvents = deletedUids.length;
    }
  }

  return stats;
}

import { requireTenantAccess } from "../_shared/tenant-access.ts";
import { canForceCalendarResync } from "../_shared/tenant-policy.ts";

Deno.serve(withSafeHandler("sync-external-calendar", async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Internal schedulers call with the server credential; users must own the calendar.
  const isInternal = requireServiceRole(req);
  const auth = isInternal ? null : await requireAuth(req);
  if (!isInternal && !auth) return unauthorizedResponse();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { calendar_id, tenant_id } = await req.json();
    const access = isInternal ? null : await requireTenantAccess({ req, functionName: "sync-external-calendar", requestedTenantId: tenant_id });
    if (access && "response" in access) return access.response;

    if (!calendar_id) {
      return new Response(
        JSON.stringify({ error: 'calendar_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the external calendar with its configuration
    let calendarQuery = supabase.from('external_calendars').select('*').eq('id', calendar_id);
    if (access && 'tenantId' in access) calendarQuery = calendarQuery.eq('tenant_id', access.tenantId);
    const { data: calendar, error: calendarError } = await calendarQuery.single();

    if (calendarError || !calendar) {
      return new Response(
        JSON.stringify({ error: 'Calendar not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!calendar.tenant_id || (!isInternal && calendar.user_id !== auth?.userId
      && !(access && 'membership' in access && canForceCalendarResync(access.membership.role)))) {
      return new Response(
        JSON.stringify({ error: 'Calendar not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use configurable date range with increased default limit
    const startDate = new Date(calendar.sync_start_date);
    const endDate = new Date(calendar.sync_end_date);
    const maxEvents = calendar.max_events || 20000;

    // Fetch the ICS content with conditional requests (ETag and Last-Modified)

    const headers: HeadersInit = {
      'User-Agent': 'CalendarSync/1.0',
    };

    // Add conditional request headers if available
    if (calendar.last_etag) {
      headers['If-None-Match'] = calendar.last_etag;
    }
    if (calendar.last_modified_http) {
      headers['If-Modified-Since'] = calendar.last_modified_http;
    }

    const icsResponse = await fetch(calendar.ics_url, { headers });

    // Handle 304 Not Modified - calendar hasn't changed
    if (icsResponse.status === 304) {

      // Update last_sync timestamp without downloading
      const { error: updateError } = await supabase
        .from('external_calendars')
        .update({
          last_sync: new Date().toISOString(),
        })
        .eq('id', calendar_id)
      .eq('tenant_id', calendar.tenant_id);

      if (updateError) {
        console.error('Error updating sync timestamp:', updateError);
      }

      return new Response(
        JSON.stringify({
          message: 'Calendar unchanged, no download needed',
          skipped: true,
          egress_saved: true,
          calendar_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!icsResponse.ok) {
      throw new Error(`Failed to fetch ICS: ${icsResponse.status} ${icsResponse.statusText}`);
    }

    const icsContent = await icsResponse.text();
    if (!icsContent.includes('BEGIN:VCALENDAR')) {
      throw new Error('Invalid ICS content: missing VCALENDAR header');
    }

    // Extract ETag and Last-Modified headers for next sync
    const etag = icsResponse.headers.get('etag');
    const lastModified = icsResponse.headers.get('last-modified');

    // Parse ICS content with configurable parameters
    const events = parseICS(icsContent, startDate, endDate, maxEvents);

    // Update calendar sync timestamp with ETag and Last-Modified
    await supabase
      .from('external_calendars')
      .update({
        last_sync: new Date().toISOString(),
        sync_errors_count: 0,
        last_sync_error: null,
        last_etag: etag,
        last_modified_http: lastModified,
      })
      .eq('id', calendar_id)
      .eq('tenant_id', calendar.tenant_id);

    // Perform incremental sync
    const syncStats = await incrementalSync(supabase, calendar_id, events);

    // Update successful sync timestamp and reset error count (ETag already set above)
    await supabase
      .from('external_calendars')
      .update({
        last_successful_sync: new Date().toISOString(),
        sync_errors_count: 0,
        last_sync_error: null
      })
      .eq('id', calendar_id)
      .eq('tenant_id', calendar.tenant_id);

    const message = `Successfully synced calendar "${calendar.name}": ` +
      `${syncStats.newEvents} new, ${syncStats.updatedEvents} updated, ` +
      `${syncStats.deletedEvents} deleted, ${syncStats.skippedEvents} unchanged, ` +
      `${syncStats.errorEvents} errors`;

    return new Response(
      JSON.stringify({
        message,
        stats: syncStats,
        calendar_name: calendar.name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Error syncing calendar:', error);

    return new Response(
      JSON.stringify({ error: 'Calendar sync failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
