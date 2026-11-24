import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  appointmentInviteUid,
  buildAppointmentIcs,
  normalizeSequence,
  validateInviteDates,
  type CalendarInviteRequest,
} from '../_shared/appointmentInvite.ts';

import { withSafeHandler, requireAuth, unauthorizedResponse } from "../_shared/security.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();

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

    if (!requestData.appointmentId || !UUID_PATTERN.test(requestData.appointmentId)) {
      return new Response(JSON.stringify({ error: 'Ungültige Termin-ID.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const dateValidationError = validateInviteDates(requestData.startTime, requestData.endTime);
    if (dateValidationError) {
      return new Response(JSON.stringify({ error: dateValidationError }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Die UID gehört zum Termin und wird nie neu erzeugt: dieselbe UID trägt
    // später auch Updates und Absagen (mit fortlaufender SEQUENCE).
    const { data: appointment } = await supabaseClient
      .from('appointments')
      .select('calendar_uid, calendar_sequence')
      .eq('id', requestData.appointmentId)
      .maybeSingle();

    const calendarUID = String(appointment?.calendar_uid ?? '').trim() || appointmentInviteUid(requestData.appointmentId);
    const sequence = normalizeSequence(appointment?.calendar_sequence);

    if (appointment && !String(appointment.calendar_uid ?? '').trim()) {
      const { error: updateError } = await supabaseClient
        .from('appointments')
        .update({ calendar_uid: calendarUID })
        .eq('id', requestData.appointmentId);

      if (updateError) {
        console.error('Error updating appointment with calendar UID:', updateError);
      }
    }

    const icsContent = buildAppointmentIcs({
      uid: calendarUID,
      sequence,
      method: 'REQUEST',
      title: requestData.title,
      description: requestData.description,
      location: requestData.location,
      startTime: requestData.startTime,
      endTime: requestData.endTime,
      organizer: requestData.organizer,
      attendees: requestData.attendees,
    });

    return new Response(JSON.stringify({ icsContent, calendarUID, sequence }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    console.error('Error in generate-calendar-invite function:', error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(withSafeHandler("generate-calendar-invite", handler));
