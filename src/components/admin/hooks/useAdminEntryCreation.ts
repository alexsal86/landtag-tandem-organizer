import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { EntryType } from "@/features/timetracking/components/AdminTimeEntryEditor";
import { validateDailyLimit } from "../utils/validationHelpers";
import { fmt, getTypeLabel } from "../utils/timeFormatting";

export interface NewEntryFormData {
  type: EntryType;
  date: string;
  startTime: string;
  endTime: string;
  pauseMinutes: number;
  reason: string;
}

interface UseAdminEntryCreationOptions {
  user: User | null;
  selectedUserId: string;
  dailyHours: number;
  yearlyBalance: number;
  onSuccess: () => void;
}

export function useAdminEntryCreation({
  user,
  selectedUserId,
  dailyHours,
  yearlyBalance,
  onSuccess,
}: UseAdminEntryCreationOptions) {
  const [isSaving, setIsSaving] = useState(false);

  const handleCreateEntry = async (data: NewEntryFormData) => {
    if (!user || !selectedUserId) return;
    setIsSaving(true);

    try {
      if (data.type === "work") {
        const start = new Date(`${data.date}T${data.startTime}`);
        const end = new Date(`${data.date}T${data.endTime}`);

        if (end <= start) {
          toast.error("Endzeit muss nach Startzeit liegen");
          return;
        }

        const grossMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

        if (data.pauseMinutes < 0) {
          toast.error("Die Pause darf nicht negativ sein");
          return;
        }

        if (data.pauseMinutes > grossMinutes) {
          toast.error("Die Pause darf nicht länger als die Arbeitszeit sein");
          return;
        }

        await validateDailyLimit(selectedUserId, data.date, grossMinutes);

        const netMinutes = grossMinutes - data.pauseMinutes;

        const { error } = await supabase.from("time_entries").insert([
          {
            user_id: selectedUserId,
            work_date: data.date,
            started_at: start.toISOString(),
            ended_at: end.toISOString(),
            minutes: netMinutes,
            pause_minutes: data.pauseMinutes,
            notes: data.reason || null,
            edited_by: user.id,
            edited_at: new Date().toISOString(),
            edit_reason: data.reason || "Admin-Eintrag",
          },
        ]);

        if (error) throw error;
        toast.success("Zeiteintrag erstellt");
      } else {
        if (data.type === "overtime_reduction") {
          const dailyMinutes = Math.round(dailyHours * 60);
          if (yearlyBalance < dailyMinutes) {
            toast.error(
              `Nicht genügend Überstunden vorhanden. Aktueller Saldo: ${fmt(yearlyBalance)}, benötigt: ${fmt(dailyMinutes)}`
            );
            return;
          }
        }

        const { error } = await supabase.from("leave_requests").insert([
          {
            user_id: selectedUserId,
            type: data.type,
            start_date: data.date,
            end_date: data.date,
            status: "approved",
            reason: data.reason || `Admin-Eintrag: ${getTypeLabel(data.type)}`,
          },
        ]);

        if (error) throw error;
        toast.success(`${getTypeLabel(data.type)} erstellt`);
      }

      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Erstellen");
    } finally {
      setIsSaving(false);
    }
  };

  return { handleCreateEntry, isSaving };
}
