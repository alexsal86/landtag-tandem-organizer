import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import type { Contact } from "@/hooks/useInfiniteContacts";
import type { User } from "@supabase/supabase-js";
import type { ToasterToast } from "@/hooks/use-toast";

export interface DistributionList {
  id: string;
  name: string;
  description?: string | null;
  topic?: string | null;
  created_at: string;
  member_count: number;
  members: Contact[];
}

type ToastFn = (props: ToastProps) => void;

export interface UseContactsDistributionListsResult {
  distributionLists: DistributionList[];
  distributionListsLoading: boolean;
  editingDistributionListId: string | null;
  setEditingDistributionListId: Dispatch<SetStateAction<string | null>>;
  creatingDistribution: boolean;
  setCreatingDistribution: Dispatch<SetStateAction<boolean>>;
  fetchDistributionLists: () => Promise<void>;
  deleteDistributionList: (id: string) => Promise<void>;
}

export function useContactsDistributionLists(
  user: User | null,
  currentTenantId: string | null | undefined,
  toast: ToastFn,
): UseContactsDistributionListsResult {
  const [distributionLists, setDistributionLists] = useState<DistributionList[]>([]);
  const [distributionListsLoading, setDistributionListsLoading] = useState(true);
  const [editingDistributionListId, setEditingDistributionListId] = useState<string | null>(null);
  const [creatingDistribution, setCreatingDistribution] = useState(false);

  const fetchDistributionLists = async () => {
    try {
      setDistributionListsLoading(true);

      const { data, error } = await supabase
        .from("distribution_lists")
        .select(`*, distribution_list_members(contacts(id, name, email, organization, avatar_url, category))`)
        .order("name");

      if (error) {
        throw error;
      }

      setDistributionLists(
        data?.map((list) => ({
          id: list.id,
          name: list.name,
          description: list.description,
          topic: list.topic,
          created_at: list.created_at,
          member_count: list.distribution_list_members?.length || 0,
          members: list.distribution_list_members?.map((member: any) => member.contacts) || [],
        })) || [],
      );
    } catch (error) {
      debugConsole.error("Error fetching distribution lists:", error);
      toast({
        title: "Fehler",
        description: "Verteiler konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setDistributionListsLoading(false);
    }
  };

  const deleteDistributionList = async (id: string) => {
    try {
      const { error } = await supabase.from("distribution_lists").delete().eq("id", id);

      if (error) {
        throw error;
      }

      toast({ title: "Erfolg", description: "Verteiler wurde erfolgreich gelöscht." });
      await fetchDistributionLists();
    } catch (error) {
      debugConsole.error("Error deleting distribution list:", error);
      toast({
        title: "Fehler",
        description: "Verteiler konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!user || !currentTenantId) {
      return;
    }

    void fetchDistributionLists();
  }, [user, currentTenantId]);

  return {
    distributionLists,
    distributionListsLoading,
    editingDistributionListId,
    setEditingDistributionListId,
    creatingDistribution,
    setCreatingDistribution,
    fetchDistributionLists,
    deleteDistributionList,
  };
}
