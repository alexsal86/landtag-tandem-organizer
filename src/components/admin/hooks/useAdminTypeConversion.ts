import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CombinedTimeEntry } from "@/hooks/useCombinedTimeEntries";
import type { EntryType } from "@/features/timetracking/components/AdminTimeEntryEditor";
import { debugConsole } from "@/utils/debugConsole";
import { getTypeLabel } from "../utils/timeFormatting";

interface UseAdminTypeConversionOptions {
  user: User | null;
  selectedUserId: string;
  onSuccess: () => void;
}

export function useAdminTypeConversion({ user, selectedUserId, onSuccess }: UseAdminTypeConversionOptions) {
  const [isSaving, setIsSaving] = useState(false);

  const handleTypeChange = async (
    entryId: string,
    newType: EntryType,
    reason: string,
    editingCombinedEntry: CombinedTimeEntry | null,
    leaveId?: string
  ) => {
    if (!user || !selectedUserId) return;
    setIsSaving(true);

    const entry = editingCombinedEntry;
    if (!entry) {
      toast.error("Kein Eintrag ausgewählt");
      setIsSaving(false);
      return;
    }

    const originalType = entry.entry_type;
    const actualLeaveId = leaveId || entry.leave_id;
    const actualWorkEntryId = originalType === "work" ? entryId : null;

    try {
      if (originalType === "work" && newType !== "work") {
        if (!actualWorkEntryId) throw new Error("Keine gültige Arbeitszeit-ID");

        const { error: deleteError } = await supabase
          .from("time_entries")
          .delete()
          .eq("id", actualWorkEntryId);

        if (deleteError && !deleteError.message?.includes("fetch")) {
          throw deleteError;
        }

        const { error: insertError } = await supabase.from("leave_requests").insert([
          {
            user_id: selectedUserId,
            type: newType,
            start_date: entry.work_date,
            end_date: entry.work_date,
            status: "approved",
            reason: `Admin-Umwandlung: ${reason}`,
          },
        ]);

        if (insertError && !insertError.message?.includes("fetch")) {
          throw insertError;
        }

        toast.success(`Eintrag zu ${getTypeLabel(newType)} umgewandelt`);
      } else if (originalType !== "work" && newType === "work") {
        if (!actualLeaveId) throw new Error("Keine gültige Abwesenheits-ID");

        const { error } = await supabase
          .from("leave_requests")
          .delete()
          .eq("id", actualLeaveId);

        if (error && !error.message?.includes("fetch")) {
          throw error;
        }

        toast.info("Abwesenheit entfernt. Mitarbeiter muss Arbeitszeit manuell erfassen.");
      } else if (originalType !== "work" && newType !== "work" && originalType !== newType) {
        if (!actualLeaveId) throw new Error("Keine gültige Abwesenheits-ID");

        const { error } = await supabase
          .from("leave_requests")
          .update({
            type: newType,
            reason: `Umgewandelt von ${getTypeLabel(originalType)}: ${reason}`,
          })
          .eq("id", actualLeaveId);

        if (error && !error.message?.includes("fetch")) {
          throw error;
        }

        toast.success("Eintragstyp geändert");
      }

      setTimeout(() => onSuccess(), 500);
    } catch (error: unknown) {
      debugConsole.error("Type change error:", error);
      const msg = error instanceof Error ? error.message : "";
      toast.error(msg || "Fehler bei der Typänderung");
      if (msg.includes("fetch")) {
        setTimeout(() => onSuccess(), 500);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return { handleTypeChange, isSaving };
}
