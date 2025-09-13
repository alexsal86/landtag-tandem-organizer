import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ICSEvent {
  uid: string;
  summary: string;
  description: string;
  dtstart: string;
  dtend: string;
  last_modified?: string;
  location?: string;
  organizer?: string;
  status?: string;
  rrule?: string;
}

interface ValidationResult {
  icsEventCount: number;
  dbEventCount: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  missingInDb: number;
  extraInDb: number;
  sampleComparison: {
    icsEvents: Array<{uid: string, summary: string, dtstart: string}>;
    dbEvents: Array<{external_uid: string, title: string, start_time: string}>;
  };
  recommendations: string[];
}

function parseICSDate(dateStr: string): Date {
  // Handle YYYYMMDD format
  if (/^\d{8}$/.test(dateStr)) {
    return new Date(
      parseInt(dateStr.substring(0, 4)),
      parseInt(dateStr.substring(4, 6)) - 1,
      parseInt(dateStr.substring(6, 8))
    );
  }
  
  // Handle YYYYMMDDTHHMMSS format
  if (/^\d{8}T\d{6}/.test(dateStr)) {
    return new Date(
      parseInt(dateStr.substring(0, 4)),
      parseInt(dateStr.substring(4, 6)) - 1,
      parseInt(dateStr.substring(6, 8)),
      parseInt(dateStr.substring(9, 11)),
      parseInt(dateStr.substring(11, 13)),
      parseInt(dateStr.substring(13, 15))
    );
  }
  
  return new Date(dateStr);
}

function parseICSForValidation(icsContent: string, startDate: Date, endDate: Date): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsContent.split('\n').map(line => line.trim());
  let currentEvent: Partial<ICSEvent> | null = null;

  // Handle line folding
  const unfoldedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[i + 1].substring(1);
      i++;
    }
    unfoldedLines.push(line);
  }

  for (const line of unfoldedLines) {
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.dtstart && currentEvent.summary) {
        const eventStart = parseICSDate(currentEvent.dtstart);
        const eventEnd = currentEvent.dtend ? parseICSDate(currentEvent.dtend) : 
          new Date(eventStart.getTime() + 24 * 60 * 60 * 1000);
        
        if (eventStart <= endDate && eventEnd >= startDate) {
          events.push({
            uid: currentEvent.uid || `generated-${events.length}`,
            summary: currentEvent.summary,
            description: currentEvent.description || '',
            dtstart: currentEvent.dtstart,
            dtend: currentEvent.dtend || currentEvent.dtstart,
            last_modified: currentEvent.last_modified,
            location: currentEvent.location || '',
            organizer: currentEvent.organizer || '',
            status: currentEvent.status || 'confirmed',
            rrule: currentEvent.rrule
          } as ICSEvent);
        }
      }
      currentEvent = null;
    } else if (currentEvent) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':');
      
      switch (key) {
        case 'UID':
          currentEvent.uid = value;
          break;
        case 'SUMMARY':
          currentEvent.summary = value;
          break;
        case 'DESCRIPTION':
          currentEvent.description = value;
          break;
        case 'DTSTART':
        case 'DTSTART;VALUE=DATE':
          currentEvent.dtstart = value;
          break;
        case 'DTEND':
        case 'DTEND;VALUE=DATE':
          currentEvent.dtend = value;
          break;
        case 'LAST-MODIFIED':
          currentEvent.last_modified = value;
          break;
        case 'LOCATION':
          currentEvent.location = value;
          break;
        case 'ORGANIZER':
          currentEvent.organizer = value;
          break;
        case 'STATUS':
          currentEvent.status = value.toLowerCase();
          break;
        case 'RRULE':
          currentEvent.rrule = value;
          break;
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
    console.log('🔍 Starting ICS validation');

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

    // Get calendar configuration
    console.log(`📅 Fetching calendar config for: ${calendar_id}`);
    const { data: calendarConfig, error: configError } = await supabase
      .from('external_calendars')
      .select('*')
      .eq('id', calendar_id)
      .single();

    if (configError) {
      throw new Error(`Failed to fetch calendar config: ${configError.message}`);
    }

    console.log(`📊 Calendar: ${calendarConfig.name}`);
    console.log(`🔗 ICS URL: ${calendarConfig.ics_url}`);

    // Download ICS content
    console.log('📥 Fetching ICS content...');
    const icsResponse = await fetch(calendarConfig.ics_url);
    if (!icsResponse.ok) {
      throw new Error(`Failed to fetch ICS: ${icsResponse.status} ${icsResponse.statusText}`);
    }

    const icsContent = await icsResponse.text();
    console.log(`📄 ICS content length: ${icsContent.length} characters`);

    // Parse validation dates
    const startDate = new Date(calendarConfig.sync_start_date || '2024-01-01');
    const endDate = new Date(calendarConfig.sync_end_date || '2030-12-31');

    console.log(`📅 Validation range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Parse ICS events
    console.log('🔄 Parsing ICS events...');
    const icsEvents = parseICSForValidation(icsContent, startDate, endDate);
    console.log(`✅ Parsed ${icsEvents.length} events from ICS`);

    // Get database events
    console.log('🗄️ Fetching database events...');
    const { data: dbEvents, error: dbError } = await supabase
      .from('external_events')
      .select('external_uid, title, start_time, end_time')
      .eq('external_calendar_id', calendar_id)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString());

    if (dbError) {
      throw new Error(`Failed to fetch database events: ${dbError.message}`);
    }

    console.log(`🗄️ Found ${dbEvents.length} events in database`);

    // Create UID sets for comparison
    const icsUids = new Set(icsEvents.map(e => e.uid));
    const dbUids = new Set(dbEvents.map(e => e.external_uid));

    const missingInDb = Array.from(icsUids).filter(uid => !dbUids.has(uid)).length;
    const extraInDb = Array.from(dbUids).filter(uid => !icsUids.has(uid)).length;

    // Sample comparison (first 5 events)
    const sampleIcsEvents = icsEvents.slice(0, 5).map(e => ({
      uid: e.uid,
      summary: e.summary,
      dtstart: e.dtstart
    }));

    const sampleDbEvents = dbEvents.slice(0, 5).map(e => ({
      external_uid: e.external_uid,
      title: e.title,
      start_time: e.start_time
    }));

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (missingInDb > 0) {
      recommendations.push(`${missingInDb} events from ICS are missing in database - consider full re-sync`);
    }
    
    if (extraInDb > 0) {
      recommendations.push(`${extraInDb} events in database not found in ICS - may be outdated`);
    }
    
    if (icsEvents.length >= (calendarConfig.max_events || 5000)) {
      recommendations.push('Event limit may have been reached - increase max_events');
    }
    
    if (Math.abs(icsEvents.length - dbEvents.length) / Math.max(icsEvents.length, 1) > 0.1) {
      recommendations.push('Significant discrepancy detected - manual investigation needed');
    }

    const result: ValidationResult = {
      icsEventCount: icsEvents.length,
      dbEventCount: dbEvents.length,
      dateRangeStart: startDate.toISOString(),
      dateRangeEnd: endDate.toISOString(),
      missingInDb,
      extraInDb,
      sampleComparison: {
        icsEvents: sampleIcsEvents,
        dbEvents: sampleDbEvents
      },
      recommendations
    };

    console.log('🎉 Validation completed successfully!');
    console.log(`📊 Results: ICS=${result.icsEventCount}, DB=${result.dbEventCount}, Missing=${result.missingInDb}, Extra=${result.extraInDb}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Validation error:', error);
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