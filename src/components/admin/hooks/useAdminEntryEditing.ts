import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AdminEditData } from "@/features/timetracking/components/AdminTimeEntryEditor";
import { validateDailyLimit } from "../utils/validationHelpers";

interface UseAdminEntryEditingOptions {
  user: User | null;
  selectedUserId: string;
  onSuccess: () => void;
}

export function useAdminEntryEditing({ user, selectedUserId, onSuccess }: UseAdminEntryEditingOptions) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEntry = async (entryId: string, data: AdminEditData) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const start = new Date(`${data.work_date}T${data.started_at}`);
      const end = new Date(`${data.work_date}T${data.ended_at}`);

      if (end <= start) {
        toast.error("Endzeit muss nach Startzeit liegen");
        return;
      }

      const grossMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

      if (data.pause_minutes < 0) {
        toast.error("Die Pause darf nicht negativ sein");
        return;
      }

      if (data.pause_minutes > grossMinutes) {
        toast.error("Die Pause darf nicht länger als die Arbeitszeit sein");
        return;
      }

      await validateDailyLimit(selectedUserId, data.work_date, grossMinutes, entryId);

      const { error } = await supabase
        .from("time_entries")
        .update({
          work_date: data.work_date,
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          pause_minutes: data.pause_minutes,
          notes: data.notes,
          edited_by: user.id,
          edited_at: new Date().toISOString(),
          edit_reason: data.edit_reason,
        })
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Zeiteintrag aktualisiert");
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  return { handleSaveEntry, isSaving };
}
