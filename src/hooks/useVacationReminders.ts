import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

/**
 * Hook that checks for vacation checklist reminders:
 * - Day before vacation: remind about unchecked items
 * - Day after vacation ends: remind about items with reminder_after flag
 */
export function useVacationReminders() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  useEffect(() => {
    if (!user?.id || !currentTenant?.id) return;

    const checkReminders = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

      // Check for vacation starting tomorrow
      const { data: upcomingLeaves } = await supabase
        .from("leave_requests")
        .select("id, start_date, end_date")
        .eq("user_id", user.id)
        .eq("type", "vacation")
        .eq("status", "approved")
        .eq("start_date", tomorrow);

      if (upcomingLeaves && upcomingLeaves.length > 0) {
        for (const leave of upcomingLeaves) {
          // Check for uncompleted checklist items
          const { data: responses } = await supabase
            .from("vacation_checklist_responses")
            .select("completed, checklist_item_id")
            .eq("leave_request_id", leave.id);

          const { data: templates } = await supabase
            .from("vacation_checklist_templates")
            .select("id, label")
            .eq("tenant_id", currentTenant.id)
            .eq("is_active", true);

          if (templates && templates.length > 0) {
            const responseMap = new Map(responses?.map((r: Record<string, any>) => [r.checklist_item_id, r.completed]) || []);
            const unchecked = templates.filter((t: Record<string, any>) => !responseMap.get(t.id));

            if (unchecked.length > 0) {
              toast.warning(
                `Dein Urlaub beginnt morgen! ${unchecked.length} Checklisten-Punkt(e) noch offen: ${unchecked.map((u: Record<string, any>) => u.label).join(", ")}`,
                { duration: 10000 }
              );
            }
          }
        }
      }

      // Check for vacation that ended yesterday (reminder_after items)
      const yesterday = format(addDays(new Date(), -1), "yyyy-MM-dd");
      const { data: endedLeaves } = await supabase
        .from("leave_requests")
        .select("id, start_date, end_date")
        .eq("user_id", user.id)
        .eq("type", "vacation")
        .eq("status", "approved")
        .eq("end_date", yesterday);

      if (endedLeaves && endedLeaves.length > 0) {
        const { data: reminderTemplates } = await supabase
          .from("vacation_checklist_templates")
          .select("id, label")
          .eq("tenant_id", currentTenant.id)
          .eq("is_active", true)
          .eq("reminder_after", true);

        if (reminderTemplates && reminderTemplates.length > 0) {
          for (const leave of endedLeaves) {
            const { data: responses } = await supabase
              .from("vacation_checklist_responses")
              .select("checklist_item_id, completed")
              .eq("leave_request_id", leave.id);

            const completedMap = new Map(responses?.map((r: Record<string, any>) => [r.checklist_item_id, r.completed]) || []);
            const toReverse = reminderTemplates.filter((t: Record<string, any>) => completedMap.get(t.id));

            if (toReverse.length > 0) {
              toast.info(
                `Willkommen zurück! Bitte rückgängig machen: ${toReverse.map((t: Record<string, any>) => t.label).join(", ")}`,
                { duration: 15000 }
              );
            }
          }
        }
      }
    };

    // Check once on mount with a delay
    const timer = setTimeout(checkReminders, 3000);
    return () => clearTimeout(timer);
  }, [user?.id, currentTenant?.id]);
}
