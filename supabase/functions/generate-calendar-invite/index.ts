import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalendarInviteRequest {
  appointmentId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  organizer: {
    name: string;
    email: string;
  };
  attendees?: Array<{
    name: string;
    email: string;
  }>;
}

function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2)}@lovable.app`;
}

function formatDateToICS(date: string): string {
  return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICSValue(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function generateICS(request: CalendarInviteRequest): string {
  const uid = generateUID();
  const startTime = formatDateToICS(request.startTime);
  const endTime = formatDateToICS(request.endTime);
  const now = formatDateToICS(new Date().toISOString());
  
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lovable//Appointment Scheduler//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${startTime}`,
    `DTEND:${endTime}`,
    `SUMMARY:${escapeICSValue(request.title)}`,
    `ORGANIZER;CN=${escapeICSValue(request.organizer.name)}:mailto:${request.organizer.email}`,
  ];

  if (request.description) {
    icsContent.push(`DESCRIPTION:${escapeICSValue(request.description)}`);
  }

  if (request.location) {
    icsContent.push(`LOCATION:${escapeICSValue(request.location)}`);
  }

  // Add attendees
  if (request.attendees && request.attendees.length > 0) {
    request.attendees.forEach(attendee => {
      icsContent.push(`ATTENDEE;CN=${escapeICSValue(attendee.name)};RSVP=TRUE:mailto:${attendee.email}`);
    });
  }

  icsContent.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return icsContent.join('\r\n');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const requestData: CalendarInviteRequest = await req.json();
    
    // Generate unique calendar UID and store it
    const calendarUID = generateUID();
    
    // Update appointment with calendar UID for future reference
    const { error: updateError } = await supabaseClient
      .from('appointments')
      .update({ calendar_uid: calendarUID })
      .eq('id', requestData.appointmentId);

    if (updateError) {
      console.error('Error updating appointment with calendar UID:', updateError);
    }

    // Generate ICS content
    const icsContent = generateICS(requestData);
    
    return new Response(JSON.stringify({ icsContent, calendarUID }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('Error in generate-calendar-invite function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);