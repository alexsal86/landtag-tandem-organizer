import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { notify } from "@/lib/notify";
import { getErrorMessage } from "@/utils/errorHandler";

export interface GlobalNoteShare {
  id: string;
  user_id: string;
  shared_with_user_id: string;
  permission_type: "view" | "edit";
  created_at: string;
  shared_with_user?: { id: string; display_name: string | null; avatar_url: string | null };
}
export const useGlobalNoteSharing = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const client = useQueryClient();
  const key = ["global-note-shares", user?.id, currentTenant?.id] as const;
  const query = useQuery({
    queryKey: key, enabled: !!user && !!currentTenant,
    queryFn: async (): Promise<GlobalNoteShare[]> => {
      const { data, error } = await supabase.from("quick_note_global_shares")
        .select("id,user_id,shared_with_user_id,permission_type,created_at")
        .eq("user_id", user!.id).eq("tenant_id", currentTenant!.id);
      if (error) throw error;
      if (!data?.length) return [];
      const { data: profiles, error: profileError } = await supabase.from("profiles")
        .select("user_id,display_name,avatar_url").eq("tenant_id", currentTenant!.id).in("user_id", data.map(share => share.shared_with_user_id));
      if (profileError) throw profileError;
      return data.map(share => {
        const profile = profiles?.find(person => person.user_id === share.shared_with_user_id);
        return { ...share, permission_type: share.permission_type === "edit" ? "edit" : "view", shared_with_user: profile ? { id: profile.user_id, display_name: profile.display_name, avatar_url: profile.avatar_url } : undefined };
      });
    },
  });
  const run = async (action: () => PromiseLike<{ error: unknown }>, message: string) => {
    if (!user || !currentTenant) return false;
    try {
      const { error } = await action(); if (error) throw error;
      await client.invalidateQueries({ queryKey: key });
      notify.success(message); return true;
    } catch (error) { notify.error(getErrorMessage(error)); return false; }
  };
  return {
    globalShares: query.data ?? [], loading: query.isLoading,
    addGlobalShare: (target: string, permission: "view" | "edit" = "view") => run(() => supabase.from("quick_note_global_shares")
      .insert({ user_id: user!.id, tenant_id: currentTenant!.id, shared_with_user_id: target, permission_type: permission }).select().single(), "Notizen dieses Arbeitsbereichs freigegeben"),
    removeGlobalShare: (id: string) => run(() => supabase.from("quick_note_global_shares").delete().eq("id", id).eq("user_id", user!.id).eq("tenant_id", currentTenant!.id).select().single(), "Freigabe entfernt"),
    updateGlobalPermission: (id: string, permission: "view" | "edit") => run(() => supabase.from("quick_note_global_shares").update({ permission_type: permission }).eq("id", id).eq("user_id", user!.id).eq("tenant_id", currentTenant!.id).select().single(), "Berechtigung aktualisiert"),
    refreshGlobalShares: query.refetch,
  };
};
