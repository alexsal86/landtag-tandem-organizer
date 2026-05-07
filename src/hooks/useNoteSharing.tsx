import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { debugConsole } from '@/utils/debugConsole';
import { notifyQuickNoteShared } from "@/utils/shareNotifications";
import { STALE_TIME } from "@/lib/query-cache";
import { notify } from "@/lib/notify";

export interface NoteShare {
  id: string;
  note_id: string;
  shared_with_user_id: string;
  shared_by_user_id: string;
  permission_type: "view" | "edit";
  created_at: string;
  shared_with_user?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

async function fetchShares(noteId: string): Promise<NoteShare[]> {
  const { data, error } = await supabase
    .from("quick_note_shares")
    .select("id, note_id, shared_with_user_id, shared_by_user_id, permission_type, created_at")
    .eq("note_id", noteId);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const userIds = data.map((s: { shared_with_user_id: string }) => s.shared_with_user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  return data.map((share: { id: string; note_id: string; shared_with_user_id: string; shared_by_user_id: string; permission_type: string; created_at: string }) => ({
    ...share,
    permission_type: share.permission_type as "view" | "edit",
    shared_with_user: profiles?.find((p: { id: string }) => p.id === share.shared_with_user_id),
  }));
}

export const useNoteSharing = (noteId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["note-shares", noteId] as const;

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!noteId && !!user,
    staleTime: STALE_TIME.LIST,
    queryFn: () => fetchShares(noteId as string),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const shareNote = async (
    targetNoteId: string,
    sharedWithUserId: string,
    permissionType: "view" | "edit" = "view",
  ) => {
    if (!user) return false;
    try {
      const { error } = await supabase.from("quick_note_shares").insert([{
        note_id: targetNoteId,
        shared_with_user_id: sharedWithUserId,
        shared_by_user_id: user.id,
        permission_type: permissionType,
      }]);

      if (error) {
        if (error.code === "23505") {
          notify.error("Diese Notiz wurde bereits mit dieser Person geteilt");
        } else {
          throw error;
        }
        return false;
      }

      notify.success("Notiz erfolgreich freigegeben");

      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: noteData } = await supabase
        .from("quick_notes")
        .select("title")
        .eq("id", targetNoteId)
        .maybeSingle();

      await notifyQuickNoteShared({
        recipientUserId: sharedWithUserId,
        senderName: senderProfile?.display_name,
        itemTitle: noteData?.title,
        itemId: targetNoteId,
      });

      invalidate();
      return true;
    } catch (error) {
      debugConsole.error("Error sharing note:", error);
      notify.error("Fehler beim Freigeben der Notiz");
      return false;
    }
  };

  const unshareNote = async (shareId: string) => {
    try {
      const { data: deleted, error } = await supabase
        .from("quick_note_shares")
        .delete()
        .eq("id", shareId)
        .select();
      if (error) throw error;
      if (!deleted || deleted.length === 0) {
        notify.error("Freigabe konnte nicht entfernt werden");
        return false;
      }
      notify.success("Freigabe entfernt");
      invalidate();
      return true;
    } catch (error) {
      debugConsole.error("Error removing share:", error);
      notify.error("Fehler beim Entfernen der Freigabe");
      return false;
    }
  };

  const updatePermission = async (shareId: string, permissionType: "view" | "edit") => {
    if (!user) return false;
    try {
      const { data: shareData, error: fetchError } = await supabase
        .from("quick_note_shares")
        .select("note_id")
        .eq("id", shareId)
        .single();
      if (fetchError || !shareData) {
        debugConsole.error("Error fetching share:", fetchError);
        notify.error("Freigabe nicht gefunden");
        return false;
      }

      const { data: updated, error } = await supabase
        .from("quick_note_shares")
        .update({ permission_type: permissionType })
        .eq("id", shareId)
        .eq("note_id", shareData.note_id)
        .select();
      if (error) throw error;
      if (!updated || updated.length === 0) {
        notify.error("Berechtigung konnte nicht aktualisiert werden");
        return false;
      }
      notify.success("Berechtigung aktualisiert");
      invalidate();
      return true;
    } catch (error) {
      debugConsole.error("Error updating permission:", error);
      notify.error("Fehler beim Aktualisieren der Berechtigung");
      return false;
    }
  };

  return {
    shares: data ?? [],
    loading: isLoading,
    shareNote,
    unshareNote,
    updatePermission,
    refreshShares: refetch,
  };
};
