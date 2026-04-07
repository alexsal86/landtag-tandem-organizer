import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

export interface PlannerNote {
  id: string;
  tenant_id: string;
  note_date: string;
  content: string;
  color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const NOTE_COLORS = [
  { value: "yellow", bg: "bg-yellow-100 dark:bg-yellow-900/40", border: "border-yellow-300 dark:border-yellow-700" },
  { value: "orange", bg: "bg-orange-100 dark:bg-orange-900/40", border: "border-orange-300 dark:border-orange-700" },
  { value: "pink", bg: "bg-pink-100 dark:bg-pink-900/40", border: "border-pink-300 dark:border-pink-700" },
  { value: "purple", bg: "bg-purple-100 dark:bg-purple-900/40", border: "border-purple-300 dark:border-purple-700" },
  { value: "blue", bg: "bg-blue-100 dark:bg-blue-900/40", border: "border-blue-300 dark:border-blue-700" },
  { value: "green", bg: "bg-green-100 dark:bg-green-900/40", border: "border-green-300 dark:border-green-700" },
] as const;

export function getColorClasses(color: string) {
  return NOTE_COLORS.find((c) => c.value === color) || NOTE_COLORS[0];
}

export function usePlannerNotes() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [notes, setNotes] = useState<PlannerNote[]>([]);

  const loadNotes = useCallback(async () => {
    if (!user?.id || !currentTenant?.id) return;
    const { data, error } = await supabase
      .from("social_planner_notes")
      .select("*")
      .eq("tenant_id", currentTenant.id)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Error loading planner notes:", error);
      return;
    }
    setNotes((data || []) as PlannerNote[]);
  }, [user?.id, currentTenant?.id]);

  const createNote = useCallback(async (noteDate: string, content: string, color = "yellow") => {
    if (!user?.id || !currentTenant?.id) return;
    const { error } = await supabase.from("social_planner_notes").insert({
      tenant_id: currentTenant.id,
      note_date: noteDate,
      content,
      color,
      created_by: user.id,
    });
    if (error) throw error;
    await loadNotes();
  }, [user?.id, currentTenant?.id, loadNotes]);

  const updateNote = useCallback(async (id: string, patch: Partial<Pick<PlannerNote, "content" | "color">>) => {
    if (!currentTenant?.id) return;
    const { error } = await supabase.from("social_planner_notes").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).eq("tenant_id", currentTenant.id);
    if (error) throw error;
    await loadNotes();
  }, [currentTenant?.id, loadNotes]);

  const deleteNote = useCallback(async (id: string) => {
    if (!currentTenant?.id) return;
    const { error } = await supabase.from("social_planner_notes").delete().eq("id", id).eq("tenant_id", currentTenant.id);
    if (error) throw error;
    await loadNotes();
  }, [currentTenant?.id, loadNotes]);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  return useMemo(() => ({ notes, loadNotes, createNote, updateNote, deleteNote }), [notes, loadNotes, createNote, updateNote, deleteNote]);
}
