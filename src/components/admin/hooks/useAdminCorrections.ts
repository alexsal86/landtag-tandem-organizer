import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { getYear } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface UseAdminCorrectionsOptions {
  user: User | null;
  selectedUserId: string;
  currentMonth: Date;
  onSuccess: () => void;
}

export function useAdminCorrections({
  user,
  selectedUserId,
  currentMonth,
  onSuccess,
}: UseAdminCorrectionsOptions) {
  const handleAddCorrection = async (minutes: number, reason: string) => {
    if (!user || !selectedUserId || !reason.trim()) return;

    if (isNaN(minutes)) {
      toast.error("Bitte gültige Minutenzahl eingeben");
      return;
    }

    try {
      const { error } = await supabase.from("time_entry_corrections").insert([
        {
          user_id: selectedUserId,
          correction_minutes: minutes,
          reason,
          created_by: user.id,
        },
      ]);

      if (error) throw error;

      toast.success("Korrektur hinzugefügt");
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern der Korrektur");
    }
  };

  const handleAddInitialBalance = async (minutes: number) => {
    if (!user || !selectedUserId) return;

    if (isNaN(minutes)) {
      toast.error("Bitte gültige Minutenzahl eingeben");
      return;
    }

    try {
      const yearStart = `${getYear(currentMonth)}-01-01`;

      const { data: existing } = await supabase
        .from("time_entry_corrections")
        .select("id")
        .eq("user_id", selectedUserId)
        .eq("correction_date", yearStart)
        .ilike("reason", "%Übertrag%Vorjahr%");

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from("time_entry_corrections")
          .update({ correction_minutes: minutes, created_by: user.id })
          .eq("id", existing[0].id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("time_entry_corrections").insert([
          {
            user_id: selectedUserId,
            correction_date: yearStart,
            correction_minutes: minutes,
            reason: `Übertrag aus Vorjahr ${getYear(currentMonth) - 1}`,
            created_by: user.id,
          },
        ]);
        if (error) throw error;
      }

      toast.success("Anfangsbestand gespeichert");
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern");
    }
  };

  return { handleAddCorrection, handleAddInitialBalance };
}
