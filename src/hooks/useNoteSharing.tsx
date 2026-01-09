import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

export const useNoteSharing = (noteId?: string) => {
  const { user } = useAuth();
  const [shares, setShares] = useState<NoteShare[]>([]);
  const [loading, setLoading] = useState(false);

  const loadShares = useCallback(async () => {
    if (!noteId || !user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quick_note_shares")
        .select("*")
        .eq("note_id", noteId);

      if (error) throw error;

      // Load user profiles for shared users
      if (data && data.length > 0) {
        const userIds = data.map((s) => s.shared_with_user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds);

        const sharesWithUsers = data.map((share) => ({
          ...share,
          permission_type: share.permission_type as "view" | "edit",
          shared_with_user: profiles?.find((p) => p.id === share.shared_with_user_id),
        }));

        setShares(sharesWithUsers);
      } else {
        setShares([]);
      }
    } catch (error) {
      console.error("Error loading shares:", error);
    } finally {
      setLoading(false);
    }
  }, [noteId, user]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const shareNote = async (
    targetNoteId: string,
    sharedWithUserId: string,
    permissionType: "view" | "edit" = "view"
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase.from("quick_note_shares").insert({
        note_id: targetNoteId,
        shared_with_user_id: sharedWithUserId,
        shared_by_user_id: user.id,
        permission_type: permissionType,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Diese Notiz wurde bereits mit dieser Person geteilt");
        } else {
          throw error;
        }
        return false;
      }

      toast.success("Notiz erfolgreich freigegeben");
      loadShares();
      return true;
    } catch (error) {
      console.error("Error sharing note:", error);
      toast.error("Fehler beim Freigeben der Notiz");
      return false;
    }
  };

  const unshareNote = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from("quick_note_shares")
        .delete()
        .eq("id", shareId);

      if (error) throw error;

      toast.success("Freigabe entfernt");
      loadShares();
      return true;
    } catch (error) {
      console.error("Error removing share:", error);
      toast.error("Fehler beim Entfernen der Freigabe");
      return false;
    }
  };

  const updatePermission = async (shareId: string, permissionType: "view" | "edit") => {
    try {
      const { error } = await supabase
        .from("quick_note_shares")
        .update({ permission_type: permissionType })
        .eq("id", shareId);

      if (error) throw error;

      toast.success("Berechtigung aktualisiert");
      loadShares();
      return true;
    } catch (error) {
      console.error("Error updating permission:", error);
      toast.error("Fehler beim Aktualisieren der Berechtigung");
      return false;
    }
  };

  return {
    shares,
    loading,
    shareNote,
    unshareNote,
    updatePermission,
    refreshShares: loadShares,
  };
};
