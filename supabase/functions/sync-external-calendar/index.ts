import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: string;
  dtend?: string;
  location?: string;
  allDay?: boolean;
  rrule?: string;
  lastModified?: string;
}

interface SyncStats {
  totalParsed: number;
  newEvents: number;
  updatedEvents: number;
  skippedEvents: number;
  errorEvents: number;
  deletedEvents: number;
}

function parseICSDate(dateStr: string): Date {
  // Handle both DATE-TIME and DATE formats
  if (dateStr.includes('T')) {
    // DATE-TIME format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(dateStr.substring(6, 8));
    const hour = parseInt(dateStr.substring(9, 11)) || 0;
    const minute = parseInt(dateStr.substring(11, 13)) || 0;
    const second = parseInt(dateStr.substring(13, 15)) || 0;
    
    return new Date(year, month, day, hour, minute, second);
  } else {
    // DATE format: YYYYMMDD (all-day event)
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    
    return new Date(year, month, day);
  }
}

function parseICS(icsContent: string, startDate: Date, endDate: Date, maxEvents: number): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsContent.split(/\r?\n/);
  let currentEvent: Partial<ICSEvent> | null = null;
  
  console.log(`📅 Processing ICS with date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  console.log(`🔢 Max events limit: ${maxEvents}`);
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Handle line folding (lines starting with space or tab)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      i++;
      line += lines[i].trim();
    }
    
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      // Enhanced validation with better error handling
      if (currentEvent.uid && currentEvent.summary && currentEvent.dtstart) {
        try {
          // Improved filtering: check if event overlaps with our date range
          const eventStart = parseICSDate(currentEvent.dtstart);
          const eventEnd = currentEvent.dtend ? parseICSDate(currentEvent.dtend) : 
            // For all-day events or events without end time, assume 1 day duration
            new Date(eventStart.getTime() + 24 * 60 * 60 * 1000);
          
          // Event overlaps if: event_start <= range_end AND event_end >= range_start
          const overlapsWithRange = eventStart <= endDate && eventEnd >= startDate;
          
          if (overlapsWithRange) {
            events.push(currentEvent as ICSEvent);
          }
        } catch (parseError) {
          console.warn(`⚠️ Failed to parse event ${currentEvent.uid}: ${parseError.message}`);
        }
      } else {
        // Log incomplete events for debugging
        const missingFields = [];
        if (!currentEvent.uid) missingFields.push('uid');
        if (!currentEvent.summary) missingFields.push('summary');
        if (!currentEvent.dtstart) missingFields.push('dtstart');
        console.warn(`⚠️ Skipping incomplete event - missing: ${missingFields.join(', ')}`);
      }
      currentEvent = null;
      
      // Use configurable event limit
      if (events.length >= maxEvents) {
        console.log(`⚠️ Reached event limit of ${maxEvents} events, stopping parse`);
        break;
      }
    } else if (currentEvent) {
      if (line.startsWith('UID:')) {
        currentEvent.uid = line.substring(4);
      } else if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.substring(8);
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.substring(12);
      } else if (line.startsWith('DTSTART')) {
        const value = line.split(':')[1];
        currentEvent.dtstart = value;
        currentEvent.allDay = !value.includes('T');
      } else if (line.startsWith('DTEND')) {
        currentEvent.dtend = line.split(':')[1];
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9);
      } else if (line.startsWith('RRULE:')) {
        currentEvent.rrule = line.substring(6);
      } else if (line.startsWith('LAST-MODIFIED:')) {
        currentEvent.lastModified = line.substring(14);
      }
    }
  }
  
  return events;
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

  console.log(`🔄 Starting incremental sync for ${newEvents.length} parsed events`);

  // Get existing events with their last_modified timestamps
  const { data: existingEvents, error: existingError } = await supabase
    .from('external_events')
    .select('external_uid, last_modified')
    .eq('external_calendar_id', calendarId);

  if (existingError) {
    console.error('❌ Error fetching existing events:', existingError);
    throw new Error(`Failed to fetch existing events: ${existingError.message}`);
  }

  // Create a map of existing events for quick lookup
  const existingEventsMap = new Map();
  if (existingEvents) {
    existingEvents.forEach(event => {
      existingEventsMap.set(event.external_uid, event.last_modified);
    });
  }

  console.log(`📊 Found ${existingEventsMap.size} existing events in database`);

  // Process new events in batches for UPSERT
  const batchSize = 25; // Smaller batches for better reliability
  const eventsToProcess = [];

  for (const event of newEvents) {
    const startTime = parseICSDate(event.dtstart);
    let endTime = startTime;
    
    if (event.dtend) {
      endTime = parseICSDate(event.dtend);
    } else if (event.allDay) {
      // All-day events end at the start of the next day
      endTime = new Date(startTime);
      endTime.setDate(endTime.getDate() + 1);
    } else {
      // Default 1-hour duration for events without end time
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    }

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
      last_modified: event.lastModified ? parseICSDate(event.lastModified).toISOString() : new Date().toISOString(),
    };

    // Check if we need to process this event
    const existingLastModified = existingEventsMap.get(event.uid);
    
    if (!existingLastModified) {
      // New event
      eventsToProcess.push({ ...eventData, action: 'new' });
    } else if (event.lastModified) {
      const newLastModified = parseICSDate(event.lastModified);
      const existingDate = new Date(existingLastModified);
      
      if (newLastModified > existingDate) {
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

  console.log(`🔄 Processing ${eventsToProcess.length} events (${stats.skippedEvents} skipped as unchanged)`);

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
  
  if (duplicatesRemoved > 0) {
    console.log(`🔄 Removed ${duplicatesRemoved} duplicate UIDs from processing batch`);
  }

  // Process events in batches using UPSERT
  for (let i = 0; i < dedupedEvents.length; i += batchSize) {
    const batch = dedupedEvents.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(dedupedEvents.length / batchSize);
    
    try {
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} events)`);
      
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

      console.log(`✅ Batch ${batchNumber} completed: ${batchNewCount} new, ${batchUpdateCount} updated, ${batchErrorCount} errors`);
      
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
    console.log(`🗑️ Removing ${deletedUids.length} deleted events`);
    
    const { error: deleteError } = await supabase
      .from('external_events')
      .delete()
      .eq('external_calendar_id', calendarId)
      .in('external_uid', deletedUids);

    if (deleteError) {
      console.error('❌ Error deleting removed events:', deleteError);
    } else {
      stats.deletedEvents = deletedUids.length;
      console.log(`✅ Successfully deleted ${deletedUids.length} events`);
    }
  }

  return stats;
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

    const { calendar_id } = await req.json();

    if (!calendar_id) {
      return new Response(
        JSON.stringify({ error: 'calendar_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🚀 Starting sync for calendar: ${calendar_id}`);

    // Get the external calendar with its configuration
    const { data: calendar, error: calendarError } = await supabase
      .from('external_calendars')
      .select('*')
      .eq('id', calendar_id)
      .single();

    if (calendarError || !calendar) {
      return new Response(
        JSON.stringify({ error: 'Calendar not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📅 Calendar: ${calendar.name}`);
    console.log(`🔗 ICS URL: ${calendar.ics_url}`);
    console.log(`📊 Config - Start: ${calendar.sync_start_date}, End: ${calendar.sync_end_date}, Max Events: ${calendar.max_events}`);

    // Use configurable date range with increased default limit
    const startDate = new Date(calendar.sync_start_date);
    const endDate = new Date(calendar.sync_end_date);
    const maxEvents = calendar.max_events || 20000;

    // Fetch the ICS content
    console.log('📥 Fetching ICS content...');
    const icsResponse = await fetch(calendar.ics_url);
    
    if (!icsResponse.ok) {
      throw new Error(`Failed to fetch ICS: ${icsResponse.status} ${icsResponse.statusText}`);
    }

    const icsContent = await icsResponse.text();
    console.log(`📄 ICS content length: ${icsContent.length} characters`);

    // Parse ICS content with configurable parameters
    const events = parseICS(icsContent, startDate, endDate, maxEvents);
    console.log(`✅ Parsed ${events.length} events from ICS`);

    // Update calendar sync timestamp
    await supabase
      .from('external_calendars')
      .update({ 
        last_sync: new Date().toISOString(),
        sync_errors_count: 0,
        last_sync_error: null
      })
      .eq('id', calendar_id);

    // Perform incremental sync
    const syncStats = await incrementalSync(supabase, calendar_id, events);

    // Update successful sync timestamp and reset error count
    await supabase
      .from('external_calendars')
      .update({ 
        last_successful_sync: new Date().toISOString(),
        sync_errors_count: 0,
        last_sync_error: null
      })
      .eq('id', calendar_id);

    console.log(`🎉 Sync completed successfully!`);
    console.log(`📊 Stats:`, syncStats);

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
    
    // Try to update error information in calendar
    try {
      const { calendar_id } = await req.json();
      if (calendar_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabase
          .from('external_calendars')
          .update({ 
            sync_errors_count: 1, // Will be incremented by app logic if needed
            last_sync_error: error.message,
            last_sync: new Date().toISOString()
          })
          .eq('id', calendar_id);
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
