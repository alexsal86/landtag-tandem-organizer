import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface GlobalNoteShare {
  id: string;
  user_id: string;
  shared_with_user_id: string;
  permission_type: "view" | "edit";
  created_at: string;
  shared_with_user?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export const useGlobalNoteSharing = () => {
  const { user } = useAuth();
  const [globalShares, setGlobalShares] = useState<GlobalNoteShare[]>([]);
  const [loading, setLoading] = useState(false);

  const loadGlobalShares = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quick_note_global_shares")
        .select("*")
        .eq("user_id", user.id);

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

        setGlobalShares(sharesWithUsers);
      } else {
        setGlobalShares([]);
      }
    } catch (error) {
      console.error("Error loading global shares:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadGlobalShares();
  }, [loadGlobalShares]);

  const addGlobalShare = async (
    sharedWithUserId: string,
    permissionType: "view" | "edit" = "view"
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase.from("quick_note_global_shares").insert({
        user_id: user.id,
        shared_with_user_id: sharedWithUserId,
        permission_type: permissionType,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Bereits für diese Person freigegeben");
        } else {
          throw error;
        }
        return false;
      }

      toast.success("Alle Notizen erfolgreich freigegeben");
      loadGlobalShares();
      return true;
    } catch (error) {
      console.error("Error adding global share:", error);
      toast.error("Fehler beim Freigeben");
      return false;
    }
  };

  const removeGlobalShare = async (shareId: string) => {
    if (!shareId) {
      console.error("No share ID provided for removal");
      toast.error("Fehler: Keine Freigabe-ID");
      return false;
    }

    if (!user) {
      console.error("No user authenticated for share removal");
      toast.error("Fehler: Nicht authentifiziert");
      return false;
    }

    console.log("Attempting to remove global share:", shareId);
    
    try {
      const { error, data } = await supabase
        .from("quick_note_global_shares")
        .delete()
        .eq("id", shareId)
        .eq("user_id", user.id)
        .select();

      if (error) {
        console.error("Supabase delete error:", error);
        throw error;
      }

      console.log("Deleted share result:", data);
      
      if (!data || data.length === 0) {
        console.warn("No share found with ID:", shareId);
        toast.error("Freigabe nicht gefunden");
        return false;
      }

      toast.success("Globale Freigabe entfernt");
      loadGlobalShares();
      return true;
    } catch (error) {
      console.error("Error removing global share:", error);
      toast.error("Fehler beim Entfernen der Freigabe");
      return false;
    }
  };

  const updateGlobalPermission = async (shareId: string, permissionType: "view" | "edit") => {
    try {
      const { error } = await supabase
        .from("quick_note_global_shares")
        .update({ permission_type: permissionType })
        .eq("id", shareId);

      if (error) throw error;

      toast.success("Berechtigung aktualisiert");
      loadGlobalShares();
      return true;
    } catch (error) {
      console.error("Error updating permission:", error);
      toast.error("Fehler beim Aktualisieren der Berechtigung");
      return false;
    }
  };

  return {
    globalShares,
    loading,
    addGlobalShare,
    removeGlobalShare,
    updateGlobalPermission,
    refreshGlobalShares: loadGlobalShares,
  };
};
