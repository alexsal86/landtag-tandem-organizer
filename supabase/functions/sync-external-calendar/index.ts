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

function parseICS(icsContent: string): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsContent.split(/\r?\n/);
  let currentEvent: Partial<ICSEvent> | null = null;
  
  // Only process events from 3 months ago to 6 months in the future
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const sixMonthsLater = new Date();
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
  
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
      if (currentEvent.uid && currentEvent.summary && currentEvent.dtstart) {
        // Filter by date range
        const eventDate = parseICSDate(currentEvent.dtstart);
        if (eventDate >= threeMonthsAgo && eventDate <= sixMonthsLater) {
          events.push(currentEvent as ICSEvent);
        }
      }
      currentEvent = null;
      
      // Limit to maximum 1000 events to prevent timeout
      if (events.length >= 1000) {
        console.log(`Limiting to ${events.length} events to prevent timeout`);
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

    // Get the external calendar
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

    // Fetch the ICS content
    console.log('Fetching ICS from:', calendar.ics_url);
    const icsResponse = await fetch(calendar.ics_url);
    
    if (!icsResponse.ok) {
      throw new Error(`Failed to fetch ICS: ${icsResponse.status} ${icsResponse.statusText}`);
    }

    const icsContent = await icsResponse.text();
    console.log('ICS content length:', icsContent.length);

    // Parse ICS content
    const events = parseICS(icsContent);
    console.log('Parsed events:', events.length);

    // Update calendar last_sync
    await supabase
      .from('external_calendars')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', calendar_id);

    // Delete existing events for this calendar
    await supabase
      .from('external_events')
      .delete()
      .eq('external_calendar_id', calendar_id);

    // Insert new events
    const eventsToInsert = events.map(event => {
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

      return {
        external_calendar_id: calendar_id,
        external_uid: event.uid,
        title: event.summary,
        description: event.description || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        location: event.location || null,
        all_day: event.allDay || false,
        recurrence_rule: event.rrule || null,
        raw_ics_data: event,
        last_modified: event.lastModified ? parseICSDate(event.lastModified).toISOString() : null,
      };
    });

    // Insert new events in batches to prevent timeout
    if (eventsToInsert.length > 0) {
      console.log(`Inserting ${eventsToInsert.length} events in batches...`);
      
      const batchSize = 100;
      for (let i = 0; i < eventsToInsert.length; i += batchSize) {
        const batch = eventsToInsert.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('external_events')
          .insert(batch);

        if (insertError) {
          console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
          throw insertError;
        }
        
        console.log(`Inserted batch ${i / batchSize + 1}/${Math.ceil(eventsToInsert.length / batchSize)}`);
      }
    }

    console.log(`Successfully synced ${eventsToInsert.length} events for calendar ${calendar.name}`);

    return new Response(
      JSON.stringify({ 
        message: `Successfully synced ${eventsToInsert.length} events`,
        synced_events: eventsToInsert.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing calendar:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});