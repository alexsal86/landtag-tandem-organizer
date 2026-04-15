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
  visible_to_all: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_by_avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export const NOTE_COLORS = [
  { value: "yellow", label: "Gelb", bg: "bg-yellow-100 dark:bg-yellow-900/40", bgActive: "bg-yellow-50 dark:bg-yellow-900/25", border: "border-yellow-300 dark:border-yellow-700", solid: "bg-yellow-200 border-yellow-300", icon: "text-yellow-600 dark:text-yellow-300" },
  { value: "orange", label: "Orange", bg: "bg-orange-100 dark:bg-orange-900/40", bgActive: "bg-orange-50 dark:bg-orange-900/25", border: "border-orange-300 dark:border-orange-700", solid: "bg-orange-200 border-orange-300", icon: "text-orange-600 dark:text-orange-300" },
  { value: "pink", label: "Pink", bg: "bg-pink-100 dark:bg-pink-900/40", bgActive: "bg-pink-50 dark:bg-pink-900/25", border: "border-pink-300 dark:border-pink-700", solid: "bg-pink-200 border-pink-300", icon: "text-pink-600 dark:text-pink-300" },
  { value: "purple", label: "Lila", bg: "bg-purple-100 dark:bg-purple-900/40", bgActive: "bg-purple-50 dark:bg-purple-900/25", border: "border-purple-300 dark:border-purple-700", solid: "bg-purple-200 border-purple-300", icon: "text-purple-600 dark:text-purple-300" },
  { value: "blue", label: "Blau", bg: "bg-blue-100 dark:bg-blue-900/40", bgActive: "bg-blue-50 dark:bg-blue-900/25", border: "border-blue-300 dark:border-blue-700", solid: "bg-blue-200 border-blue-300", icon: "text-blue-600 dark:text-blue-300" },
  { value: "green", label: "Grün", bg: "bg-green-100 dark:bg-green-900/40", bgActive: "bg-green-50 dark:bg-green-900/25", border: "border-green-300 dark:border-green-700", solid: "bg-green-200 border-green-300", icon: "text-green-600 dark:text-green-300" },
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
      .select("id, tenant_id, note_date, content, color, visible_to_all, created_by, created_at, updated_at")
      .eq("tenant_id", currentTenant.id)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Error loading planner notes:", error);
      return;
    }
    const noteRows = (data || []) as Array<PlannerNote>;
    const creatorIds = [...new Set(noteRows.map((note) => note.created_by).filter((id): id is string => Boolean(id)))];

    let creatorMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
    if (creatorIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", creatorIds);
      if (profilesError) {
        console.error("Error loading note creators:", profilesError);
      } else {
        creatorMap = new Map(
          (profilesData || []).map((profile) => [
            profile.user_id,
            { display_name: profile.display_name, avatar_url: profile.avatar_url },
          ]),
        );
      }
    }

    setNotes(
      noteRows.map((note) => ({
        ...note,
        visible_to_all: note.visible_to_all ?? false,
        created_by_name: note.created_by ? (creatorMap.get(note.created_by)?.display_name ?? null) : null,
        created_by_avatar_url: note.created_by ? (creatorMap.get(note.created_by)?.avatar_url ?? null) : null,
      })),
    );
  }, [user?.id, currentTenant?.id]);

  const createNote = useCallback(async (noteDate: string, content: string, color = "yellow") => {
    if (!user?.id || !currentTenant?.id) return;
    const { error } = await supabase.from("social_planner_notes").insert({
      tenant_id: currentTenant.id,
      note_date: noteDate,
      content,
      color,
      visible_to_all: false,
      created_by: user.id,
    });
    if (error) throw error;
    await loadNotes();
  }, [user?.id, currentTenant?.id, loadNotes]);

  const updateNote = useCallback(async (id: string, patch: Partial<Pick<PlannerNote, "content" | "color" | "visible_to_all">>) => {
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
