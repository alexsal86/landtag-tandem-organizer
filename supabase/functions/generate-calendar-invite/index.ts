import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { CalendarInviteRequest, generateICS, generateUID, validateInviteDates } from './generate-calendar-invite.utils.ts';

import { withSafeHandler } from "../_shared/security.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(withSafeHandler("generate-calendar-invite", handler));
