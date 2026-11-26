import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { notify } from "@/lib/notify";
import { debugConsole } from "@/utils/debugConsole";
import {
  ENTITY_TOPIC_CONFIG,
  type TopicEntityType,
} from "./entityTopicConfig";

export { ENTITY_TOPIC_CONFIG, type TopicEntityType } from "./entityTopicConfig";

export function entityTopicsKey(
  entityType: TopicEntityType,
  tenantId: string | undefined,
  entityId: string | null | undefined,
) {
  return ["entity-topics", entityType, tenantId ?? null, entityId ?? null] as const;
}

/** Batch lookup for list screens; returns entity id -> topic ids. */
export async function fetchEntityTopicIds(
  entityType: TopicEntityType,
  entityIds: string[],
  tenantId: string | undefined,
): Promise<Record<string, string[]>> {
  const uniqueIds = [...new Set(entityIds.filter(Boolean))];
  if (!tenantId || uniqueIds.length === 0) return {};

  let rows: Array<{ entityId: string; topicId: string }> = [];

  if (entityType === "contact") {
    const { data, error } = await supabase
      .from("contact_topics")
      .select("contact_id, topic_id")
      .eq("tenant_id", tenantId)
      .in("contact_id", uniqueIds);
    if (error) throw error;
    rows = (data ?? []).map((row) => ({ entityId: row.contact_id, topicId: row.topic_id }));
  } else if (entityType === "document") {
    const { data, error } = await supabase
      .from("document_topics")
      .select("document_id, topic_id")
      .eq("tenant_id", tenantId)
      .in("document_id", uniqueIds);
    if (error) throw error;
    rows = (data ?? []).map((row) => ({ entityId: row.document_id, topicId: row.topic_id }));
  } else {
    const { data, error } = await supabase
      .from("case_file_topics")
      .select("case_file_id, topic_id")
      .eq("tenant_id", tenantId)
      .in("case_file_id", uniqueIds);
    if (error) throw error;
    rows = (data ?? []).map((row) => ({ entityId: row.case_file_id, topicId: row.topic_id }));
  }

  const result: Record<string, string[]> = {};
  for (const row of rows) {
    if (!row.entityId) continue;
    result[row.entityId] = [...(result[row.entityId] ?? []), row.topicId];
  }
  return result;
}

async function deleteEntityTopics(
  entityType: TopicEntityType,
  entityId: string,
  tenantId: string,
) {
  if (entityType === "contact") {
    return supabase.from("contact_topics").delete().eq("contact_id", entityId).eq("tenant_id", tenantId);
  }
  if (entityType === "document") {
    return supabase.from("document_topics").delete().eq("document_id", entityId).eq("tenant_id", tenantId);
  }
  return supabase.from("case_file_topics").delete().eq("case_file_id", entityId).eq("tenant_id", tenantId);
}

async function insertEntityTopics(
  entityType: TopicEntityType,
  entityId: string,
  tenantId: string,
  userId: string,
  topicIds: string[],
) {
  const uniqueIds = [...new Set(topicIds)];
  if (entityType === "contact") {
    return supabase.from("contact_topics").insert(
      uniqueIds.map((topicId) => ({
        tenant_id: tenantId,
        contact_id: entityId,
        topic_id: topicId,
        created_by: userId,
      })),
    );
  }
  if (entityType === "document") {
    return supabase.from("document_topics").insert(
      uniqueIds.map((topicId) => ({
        tenant_id: tenantId,
        document_id: entityId,
        topic_id: topicId,
        created_by: userId,
      })),
    );
  }
  return supabase.from("case_file_topics").insert(
    uniqueIds.map((topicId) => ({
      tenant_id: tenantId,
      case_file_id: entityId,
      topic_id: topicId,
      created_by: userId,
    })),
  );
}

/**
 * Replaces all topic links of one entity. Used after creating a record when
 * no readable id exists yet, and by the entity-bound TopicPicker.
 */
export async function replaceEntityTopics(
  entityType: TopicEntityType,
  entityId: string,
  topicIds: string[],
  context: { tenantId: string; userId: string },
) {
  const uniqueIds = [...new Set(topicIds)];
  const deleteResult = await deleteEntityTopics(entityType, entityId, context.tenantId);
  if (deleteResult.error) throw deleteResult.error;
  if (uniqueIds.length === 0) return;

  const insertResult = await insertEntityTopics(
    entityType,
    entityId,
    context.tenantId,
    context.userId,
    uniqueIds,
  );
  if (insertResult.error) throw insertResult.error;
}

export function useEntityTopics(
  entityType: TopicEntityType | null,
  entityId: string | null | undefined,
) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;
  const scopeKey = entityType
    ? entityTopicsKey(entityType, tenantId, entityId)
    : (["entity-topics", "disabled"] as const);

  const query = useQuery({
    queryKey: scopeKey,
    enabled: Boolean(entityType && entityId && tenantId),
    queryFn: async ({ signal }) => {
      if (!entityType || !entityId || !tenantId) return [];
      let data: Array<{ topic_id: string }> | null = null;
      let error: unknown = null;

      if (entityType === "contact") {
        const result = await supabase
          .from("contact_topics")
          .select("topic_id")
          .eq("tenant_id", tenantId)
          .eq("contact_id", entityId)
          .order("created_at")
          .abortSignal(signal);
        data = result.data;
        error = result.error;
      } else if (entityType === "document") {
        const result = await supabase
          .from("document_topics")
          .select("topic_id")
          .eq("tenant_id", tenantId)
          .eq("document_id", entityId)
          .order("created_at")
          .abortSignal(signal);
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from("case_file_topics")
          .select("topic_id")
          .eq("tenant_id", tenantId)
          .eq("case_file_id", entityId)
          .order("created_at")
          .abortSignal(signal);
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      return (data ?? []).map((row) => row.topic_id);
    },
  });

  const mutation = useMutation({
    mutationFn: async (topicIds: string[]) => {
      if (!entityType || !entityId || !tenantId || !user?.id) {
        throw new Error("Kein aktiver Datensatz für die Themenzuordnung.");
      }
      await replaceEntityTopics(entityType, entityId, topicIds, {
        tenantId,
        userId: user.id,
      });
      return topicIds;
    },
    onSuccess: (topicIds) => {
      queryClient.setQueryData(scopeKey, topicIds);
      void queryClient.invalidateQueries({
        queryKey: ["entity-topics", entityType, tenantId, entityId],
      });
    },
    onError: (error) => {
      debugConsole.error("Error replacing entity topics:", error);
      notify.error("Themen konnten nicht gespeichert werden", {
        description: error instanceof Error ? error.message : undefined,
      });
    },
  });

  return {
    topicIds: query.data ?? [],
    loading: query.isLoading,
    saving: mutation.isPending,
    error: query.error,
    setTopics: mutation.mutateAsync,
    refetch: query.refetch,
  };
}
