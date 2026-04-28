import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import type { User } from "@supabase/supabase-js";

export interface DistributionList {
  id: string;
  name: string;
  description?: string | null;
  topic?: string | null;
  created_at: string;
  member_count: number;
}

export interface DistributionListMember {
  id: string;
  name: string;
  email?: string | null;
  organization?: string | null;
}

type ToastFn = (props: { title?: string; description?: string; variant?: "default" | "destructive" }) => void;

export interface UseContactsDistributionListsResult {
  distributionLists: DistributionList[];
  distributionListsLoading: boolean;
  editingDistributionListId: string | null;
  setEditingDistributionListId: Dispatch<SetStateAction<string | null>>;
  creatingDistribution: boolean;
  setCreatingDistribution: Dispatch<SetStateAction<boolean>>;
  fetchDistributionLists: () => Promise<void>;
  deleteDistributionList: (id: string) => Promise<void>;
  fetchDistributionListMembers: (distributionListId: string) => Promise<DistributionListMember[]>;
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

  const fetchDistributionLists = useCallback(async () => {
    try {
      setDistributionListsLoading(true);

      const { data, error } = await supabase
        .from("distribution_lists")
        .select("id, name, description, topic, created_at")
        .order("name");

      if (error) {
        throw error;
      }

      const listsWithCounts = await Promise.all(
        (data || []).map(async (list: Record<string, any>) => {
          const { count, error: countError } = await supabase
            .from("distribution_list_members")
            .select("id", { count: "exact", head: true })
            .eq("distribution_list_id", list.id);

          if (countError) {
            throw countError;
          }

          return {
            id: list.id,
            name: list.name,
            description: list.description,
            topic: list.topic,
            created_at: list.created_at,
            member_count: count || 0,
          };
        }),
      );

      setDistributionLists(listsWithCounts);
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
  }, [toast]);


  const fetchDistributionListMembers = useCallback(async (distributionListId: string): Promise<DistributionListMember[]> => {
    const { data, error } = await supabase
      .from("distribution_list_members")
      .select("contacts(id, name, email, organization)")
      .eq("distribution_list_id", distributionListId);

    if (error) {
      throw error;
    }

    return (data || [])
      .map((member: { contacts: DistributionListMember | null }) => member.contacts)
      .filter((contact: Record<string, any>): contact is DistributionListMember => Boolean(contact));
  }, []);

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
  }, [user, currentTenantId, fetchDistributionLists]);

  return {
    distributionLists,
    distributionListsLoading,
    editingDistributionListId,
    setEditingDistributionListId,
    creatingDistribution,
    setCreatingDistribution,
    fetchDistributionLists,
    deleteDistributionList,
    fetchDistributionListMembers,
  };
}
