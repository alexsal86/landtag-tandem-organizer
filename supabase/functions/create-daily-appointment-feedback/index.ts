import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppointmentFeedbackSettings {
  user_id: string;
  priority_categories: string[];
  auto_skip_internal: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting daily appointment feedback creation...');

    // Get date range (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const now = new Date();

    console.log(`Checking events from ${sevenDaysAgo.toISOString()} to ${now.toISOString()}`);

    // Find all completed appointments without feedback entries
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        id,
        user_id,
        tenant_id,
        category,
        title,
        start_time,
        end_time,
        feedback:appointment_feedback(id)
      `)
      .gte('start_time', sevenDaysAgo.toISOString())
      .lte('end_time', now.toISOString())
      .is('feedback.id', null);

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      throw appointmentsError;
    }

    console.log(`Found ${appointments?.length || 0} appointments without feedback`);

    // Find all external events without feedback entries
    const { data: externalEvents, error: externalEventsError } = await supabase
      .from('external_events')
      .select(`
        id,
        external_calendar_id,
        title,
        start_time,
        end_time,
        all_day,
        external_calendars!inner(user_id, tenant_id),
        feedback:appointment_feedback(id)
      `)
      .gte('start_time', sevenDaysAgo.toISOString())
      .lte('end_time', now.toISOString())
      .is('feedback.id', null);

    if (externalEventsError) {
      console.error('Error fetching external events:', externalEventsError);
      throw externalEventsError;
    }

    console.log(`Found ${externalEvents?.length || 0} external events without feedback`);

    if ((!appointments || appointments.length === 0) && (!externalEvents || externalEvents.length === 0)) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No events to process',
          processed: 0,
          skipped: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process events
    let processedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process appointments
    for (const appointment of appointments || []) {
      try {
        // Get user settings
        const { data: settings } = await supabase
          .from('appointment_feedback_settings')
          .select('*')
          .eq('user_id', appointment.user_id)
          .maybeSingle();

        const userSettings: AppointmentFeedbackSettings = settings || {
          user_id: appointment.user_id,
          priority_categories: ['extern', 'wichtig'],
          auto_skip_internal: false
        };

        // Check if should auto-skip internal
        if (userSettings.auto_skip_internal && appointment.category === 'intern') {
          const { error: skipError } = await supabase
            .from('appointment_feedback')
            .insert({
              appointment_id: appointment.id,
              user_id: appointment.user_id,
              tenant_id: appointment.tenant_id,
              feedback_status: 'skipped',
              priority_score: 0
            });

          if (skipError) {
            console.error(`Error creating skipped feedback for ${appointment.id}:`, skipError);
            errors.push({ appointment_id: appointment.id, error: skipError.message });
          } else {
            skippedCount++;
            console.log(`Auto-skipped internal appointment: ${appointment.title}`);
          }
          continue;
        }

        // Calculate priority score
        let priorityScore = 0;
        if (userSettings.priority_categories?.includes(appointment.category)) {
          priorityScore = 2;
        }
        if (appointment.category === 'extern') {
          priorityScore = 3;
        }

        // Create feedback entry
        const { error: insertError } = await supabase
          .from('appointment_feedback')
          .insert({
            appointment_id: appointment.id,
            user_id: appointment.user_id,
            tenant_id: appointment.tenant_id,
            event_type: 'appointment',
            feedback_status: 'pending',
            priority_score: priorityScore
          });

        if (insertError) {
          console.error(`Error creating feedback for ${appointment.id}:`, insertError);
          errors.push({ appointment_id: appointment.id, error: insertError.message });
        } else {
          processedCount++;
          console.log(`Created feedback for: ${appointment.title} (priority: ${priorityScore})`);
        }
      } catch (error) {
        console.error(`Error processing appointment ${appointment.id}:`, error);
        errors.push({ 
          appointment_id: appointment.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    // Process external events
    for (const externalEvent of externalEvents || []) {
      try {
        const calData = Array.isArray(externalEvent.external_calendars) ? externalEvent.external_calendars[0] : externalEvent.external_calendars;
        const userId = calData?.user_id;
        const tenantId = calData?.tenant_id;

        // Get user settings
        const { data: settings } = await supabase
          .from('appointment_feedback_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        const userSettings: AppointmentFeedbackSettings = settings || {
          user_id: userId,
          priority_categories: ['extern', 'wichtig'],
          auto_skip_internal: false
        };

        // External events don't have categories, so we give them a default priority
        const priorityScore = 1;

        // Create feedback entry for external event
        const { error: insertError } = await supabase
          .from('appointment_feedback')
          .insert({
            external_event_id: externalEvent.id,
            user_id: userId,
            tenant_id: tenantId,
            event_type: 'external_event',
            feedback_status: 'pending',
            priority_score: priorityScore
          });

        if (insertError) {
          console.error(`Error creating feedback for external event ${externalEvent.id}:`, insertError);
          errors.push({ event_id: externalEvent.id, error: insertError.message });
        } else {
          processedCount++;
          console.log(`Created feedback for external event: ${externalEvent.title} (priority: ${priorityScore})`);
        }
      } catch (error) {
        console.error(`Error processing external event ${externalEvent.id}:`, error);
        errors.push({ 
          event_id: externalEvent.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    console.log(`Processing complete. Created: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully processed ${processedCount} events (appointments + external), auto-skipped ${skippedCount}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
