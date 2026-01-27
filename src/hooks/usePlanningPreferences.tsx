import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

export interface DefaultCollaborator {
  user_id: string;
  can_edit: boolean;
  display_name?: string;
  avatar_url?: string | null;
}

export const usePlanningPreferences = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [defaultCollaborators, setDefaultCollaborators] = useState<DefaultCollaborator[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPreferences = useCallback(async () => {
    if (!user || !currentTenant?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_planning_preferences")
        .select("default_collaborators")
        .eq("user_id", user.id)
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.default_collaborators && Array.isArray(data.default_collaborators)) {
        // Load user profiles for collaborators
        const collabs = data.default_collaborators as { user_id: string; can_edit: boolean }[];
        
        if (collabs.length > 0) {
          const userIds = collabs.map((c) => c.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .eq("tenant_id", currentTenant.id)
            .in("user_id", userIds);

          const enrichedCollabs = collabs.map((collab) => {
            const profile = profiles?.find((p) => p.user_id === collab.user_id);
            return {
              ...collab,
              display_name: profile?.display_name || "Unbekannt",
              avatar_url: profile?.avatar_url,
            };
          });

          setDefaultCollaborators(enrichedCollabs);
        } else {
          setDefaultCollaborators([]);
        }
      } else {
        setDefaultCollaborators([]);
      }
    } catch (error) {
      console.error("Error loading planning preferences:", error);
    } finally {
      setLoading(false);
    }
  }, [user, currentTenant?.id]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const saveCollaborators = async (collaborators: DefaultCollaborator[]) => {
    if (!user || !currentTenant?.id) return false;

    try {
      // Prepare data without profile info
      const dataToSave = collaborators.map(({ user_id, can_edit }) => ({ user_id, can_edit }));

      const { error } = await supabase
        .from("user_planning_preferences")
        .upsert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          default_collaborators: dataToSave,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,tenant_id"
        });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Error saving planning preferences:", error);
      toast.error("Fehler beim Speichern der Voreinstellungen");
      return false;
    }
  };

  const addCollaborator = async (userId: string, canEdit: boolean = false) => {
    if (defaultCollaborators.some((c) => c.user_id === userId)) {
      toast.error("Bereits hinzugefügt");
      return false;
    }

    const newCollaborators = [...defaultCollaborators, { user_id: userId, can_edit: canEdit }];
    const success = await saveCollaborators(newCollaborators);
    
    if (success) {
      toast.success("Mitarbeiter hinzugefügt");
      await loadPreferences();
    }
    
    return success;
  };

  const removeCollaborator = async (userId: string) => {
    const newCollaborators = defaultCollaborators.filter((c) => c.user_id !== userId);
    const success = await saveCollaborators(newCollaborators);
    
    if (success) {
      toast.success("Mitarbeiter entfernt");
      await loadPreferences();
    }
    
    return success;
  };

  const updatePermission = async (userId: string, canEdit: boolean) => {
    const newCollaborators = defaultCollaborators.map((c) =>
      c.user_id === userId ? { ...c, can_edit: canEdit } : c
    );
    const success = await saveCollaborators(newCollaborators);
    
    if (success) {
      toast.success("Berechtigung aktualisiert");
      await loadPreferences();
    }
    
    return success;
  };

  return {
    defaultCollaborators,
    loading,
    addCollaborator,
    removeCollaborator,
    updatePermission,
    refreshPreferences: loadPreferences,
  };
};
