import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Employee {
  user_id: string;
  admin_id: string;
  next_meeting_due?: string;
  display_name?: string;
}

interface MeetingRequest {
  id: string;
  employee_id: string;
  requested_by: string;
  created_at: string;
  reason?: string;
  admin_id?: string;
}

interface ActionItem {
  id: string;
  meeting_id: string;
  description: string;
  assigned_to?: string;
  due_date: string;
  conducted_by?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    const fourteenDaysFromNow = new Date(today);
    fourteenDaysFromNow.setDate(today.getDate() + 14);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    console.log("Starting meeting reminders check...");

    // ============ 1. ÜBERFÄLLIGE GESPRÄCHE ============
    // Prüfe: next_meeting_due < heute UND kein scheduled meeting existiert
    const { data: overdueEmployees, error: overdueError } = await supabase
      .from("employee_settings")
      .select("user_id, admin_id, next_meeting_due, profiles!user_id(display_name)")
      .lt("next_meeting_due", today.toISOString())
      .not("next_meeting_due", "is", null);

    if (overdueError) {
      console.error("Error fetching overdue employees:", overdueError);
    } else if (overdueEmployees && overdueEmployees.length > 0) {
      console.log(`Found ${overdueEmployees.length} employees with overdue meetings`);

      for (const emp of overdueEmployees) {
        // Check if there's a scheduled meeting
        const { data: scheduledMeetings } = await supabase
          .from("employee_meetings")
          .select("id")
          .eq("employee_id", emp.user_id)
          .in("status", ["scheduled", "in_progress"])
          .limit(1);

        if (!scheduledMeetings || scheduledMeetings.length === 0) {
          // Send notification to admin/supervisor
          const targetUserId = emp.admin_id || emp.user_id;
          const employeeName = (emp as any).profiles?.display_name || "Mitarbeiter";

          await supabase.rpc("create_notification", {
            user_id_param: targetUserId,
            type_name: "employee_meeting_overdue",
            title_param: "Überfälliges Mitarbeitergespräch",
            message_param: `Das Gespräch mit ${employeeName} ist überfällig. Bitte terminieren Sie ein Gespräch.`,
            data_param: { employee_id: emp.user_id, next_meeting_due: emp.next_meeting_due },
            priority_param: "high",
          });

          console.log(`Notification sent for overdue meeting: ${employeeName}`);
        }
      }
    }

    // ============ 2. ANSTEHENDE GESPRÄCHE (14 & 7 Tage) ============
    const { data: upcomingEmployees14, error: upcoming14Error } = await supabase
      .from("employee_settings")
      .select("user_id, admin_id, next_meeting_due, profiles!user_id(display_name)")
      .gte("next_meeting_due", today.toISOString())
      .lte("next_meeting_due", fourteenDaysFromNow.toISOString())
      .not("next_meeting_due", "is", null);

    if (upcoming14Error) {
      console.error("Error fetching upcoming 14-day meetings:", upcoming14Error);
    } else if (upcomingEmployees14 && upcomingEmployees14.length > 0) {
      console.log(`Found ${upcomingEmployees14.length} employees with meetings due in 14 days`);

      for (const emp of upcomingEmployees14) {
        const daysUntilDue = Math.ceil(
          (new Date(emp.next_meeting_due!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Only send reminder at 14 or 7 days (avoid spam)
        if (daysUntilDue === 14 || daysUntilDue === 7) {
          const targetUserId = emp.admin_id || emp.user_id;
          const employeeName = (emp as any).profiles?.display_name || "Mitarbeiter";

          await supabase.rpc("create_notification", {
            user_id_param: targetUserId,
            type_name: "employee_meeting_due_soon",
            title_param: "Mitarbeitergespräch bald fällig",
            message_param: `Das Gespräch mit ${employeeName} ist in ${daysUntilDue} Tagen fällig.`,
            data_param: { employee_id: emp.user_id, next_meeting_due: emp.next_meeting_due, days_until_due: daysUntilDue },
            priority_param: "medium",
          });

          console.log(`Notification sent for upcoming meeting (${daysUntilDue} days): ${employeeName}`);
        }
      }
    }

    // ============ 3. OFFENE ANFRAGEN (älter als 7 Tage) ============
    const { data: overdueRequests, error: requestsError } = await supabase
      .from("employee_meeting_requests")
      .select("id, employee_id, requested_by, created_at, reason, employee_settings!employee_id(admin_id)")
      .eq("status", "pending")
      .lt("created_at", sevenDaysAgo.toISOString());

    if (requestsError) {
      console.error("Error fetching overdue requests:", requestsError);
    } else if (overdueRequests && overdueRequests.length > 0) {
      console.log(`Found ${overdueRequests.length} overdue meeting requests`);

      for (const req of overdueRequests) {
        const adminId = (req as any).employee_settings?.admin_id;
        if (!adminId) continue;

        // Get employee name
        const { data: employeeProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", req.employee_id)
          .maybeSingle();

        const employeeName = employeeProfile?.display_name || "Mitarbeiter";

        await supabase.rpc("create_notification", {
          user_id_param: adminId,
          type_name: "employee_meeting_request_overdue",
          title_param: "Unbeantwortete Gesprächsanfrage",
          message_param: `Die Gesprächsanfrage von ${employeeName} ist seit über 7 Tagen offen.`,
          data_param: { request_id: req.id, employee_id: req.employee_id, reason: req.reason },
          priority_param: "high",
        });

        console.log(`Notification sent for overdue request: ${employeeName}`);
      }
    }

    // ============ 4. ÜBERFÄLLIGE ACTION ITEMS ============
    const { data: overdueActionItems, error: actionItemsError } = await supabase
      .from("employee_meeting_action_items")
      .select("id, meeting_id, description, assigned_to, due_date, employee_meetings!meeting_id(conducted_by)")
      .lt("due_date", today.toISOString())
      .neq("status", "completed");

    if (actionItemsError) {
      console.error("Error fetching overdue action items:", actionItemsError);
    } else if (overdueActionItems && overdueActionItems.length > 0) {
      console.log(`Found ${overdueActionItems.length} overdue action items`);

      for (const item of overdueActionItems) {
        // Send to assigned person
        if (item.assigned_to) {
          await supabase.rpc("create_notification", {
            user_id_param: item.assigned_to,
            type_name: "employee_meeting_action_item_overdue",
            title_param: "Überfällige Maßnahme",
            message_param: `Eine Maßnahme ist überfällig: ${item.description.substring(0, 100)}`,
            data_param: { action_item_id: item.id, meeting_id: item.meeting_id, due_date: item.due_date },
            priority_param: "high",
          });

          console.log(`Notification sent to assigned user for overdue action item: ${item.id}`);
        }

        // Also send to supervisor (conducted_by)
        const conductedBy = (item as any).employee_meetings?.conducted_by;
        if (conductedBy && conductedBy !== item.assigned_to) {
          await supabase.rpc("create_notification", {
            user_id_param: conductedBy,
            type_name: "employee_meeting_action_item_overdue",
            title_param: "Überfällige Maßnahme (Überwachung)",
            message_param: `Eine überwachte Maßnahme ist überfällig: ${item.description.substring(0, 100)}`,
            data_param: { action_item_id: item.id, meeting_id: item.meeting_id, due_date: item.due_date },
            priority_param: "medium",
          });

          console.log(`Notification sent to supervisor for overdue action item: ${item.id}`);
        }
      }
    }

    // ============ 5. AUTOMATISCHE POLL-STATUS-UPDATES ============
    console.log("Running automatic poll status updates...");
    
    const { error: pollUpdateError } = await supabase.rpc('auto_update_poll_status');
    
    if (pollUpdateError) {
      console.error('Poll status update failed:', pollUpdateError);
    } else {
      console.log('Poll status updates completed successfully');
      
      // Get polls that changed status in the last 24 hours
      const oneDayAgo = new Date(today);
      oneDayAgo.setDate(today.getDate() - 1);
      
      const { data: statusChangedPolls } = await supabase
        .from('appointment_polls')
        .select('id, title, user_id, status')
        .in('status', ['completed', 'cancelled'])
        .gte('updated_at', oneDayAgo.toISOString());
      
      // Send notifications for status changes
      if (statusChangedPolls && statusChangedPolls.length > 0) {
        console.log(`Found ${statusChangedPolls.length} polls with recent status changes`);
        
        for (const poll of statusChangedPolls) {
          if (poll.status === 'completed') {
            await supabase.rpc('create_notification', {
              user_id_param: poll.user_id,
              type_name: 'poll_auto_completed',
              title_param: 'Abstimmung abgeschlossen',
              message_param: `Die Terminabstimmung "${poll.title}" wurde automatisch abgeschlossen.`,
              data_param: { poll_id: poll.id },
              priority_param: 'medium'
            });
          } else if (poll.status === 'cancelled') {
            await supabase.rpc('create_notification', {
              user_id_param: poll.user_id,
              type_name: 'poll_auto_cancelled',
              title_param: 'Abstimmung abgebrochen',
              message_param: `Die Terminabstimmung "${poll.title}" wurde automatisch abgebrochen (Deadline überschritten).`,
              data_param: { poll_id: poll.id },
              priority_param: 'medium'
            });
          }
        }
      }
    }

    console.log("Meeting reminders check completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          overdue_meetings: overdueEmployees?.length || 0,
          upcoming_meetings: upcomingEmployees14?.length || 0,
          overdue_requests: overdueRequests?.length || 0,
          overdue_action_items: overdueActionItems?.length || 0,
          poll_status_updates: pollUpdateError ? 'failed' : 'success',
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in check-meeting-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
