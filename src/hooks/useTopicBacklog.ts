import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from "@/utils/debugConsole";

export interface TopicBacklogEntry {
  id: string;
  topic: string;
  tags: string[];
  status: string;
  priority: number;
  owner_id: string | null;
}

export function useTopicBacklog() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [topics, setTopics] = useState<TopicBacklogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTopics = useCallback(async () => {
    if (!user?.id || !currentTenant?.id) {
      setTopics([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("topic_backlog")
        .select("id, topic, tags, status, priority, owner_id")
        .eq("tenant_id", currentTenant.id)
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false });

      if (error) throw error;

      setTopics(
        (data || []).map((row) => ({
          id: row.id,
          topic: row.topic,
          tags: row.tags || [],
          status: row.status,
          priority: row.priority,
          owner_id: row.owner_id,
        })),
      );
    } catch (error) {
      debugConsole.error("Error loading topic backlog:", error);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, user?.id]);

  const createTopic = useCallback(
    async (payload: { topic: string; tags?: string[]; priority?: number; status?: string; owner_id?: string | null }) => {
      if (!user?.id || !currentTenant?.id) return null;

      const { data, error } = await supabase
        .from("topic_backlog")
        .insert({
          tenant_id: currentTenant.id,
          created_by: user.id,
          topic: payload.topic,
          tags: payload.tags || [],
          priority: payload.priority ?? 1,
          status: payload.status || "idea",
          owner_id: payload.owner_id ?? null,
        })
        .select("id, topic, tags, status, priority, owner_id")
        .single();

      if (error) throw error;
      return data;
    },
    [currentTenant?.id, user?.id],
  );

  const updateTopic = useCallback(async (id: string, patch: Partial<TopicBacklogEntry>) => {
    const { error } = await supabase
      .from("topic_backlog")
      .update(patch)
      .eq("id", id);

    if (error) throw error;
  }, []);

  const deleteTopic = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("topic_backlog")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }, []);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    if (!currentTenant?.id) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        void loadTopics();
      }, 250);
    };

    const channel = supabase
      .channel(`topic-backlog-${currentTenant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "topic_backlog", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, loadTopics]);

  return {
    topics,
    loading,
    loadTopics,
    createTopic,
    updateTopic,
    deleteTopic,
  };
}
