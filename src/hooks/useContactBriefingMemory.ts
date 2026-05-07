import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { debugConsole } from "@/utils/debugConsole";

export type MemoryKind = "position" | "talking_point" | "qa" | "sensitive" | "role_note";

export interface ContactBriefingMemoryItem {
  id: string;
  tenant_id: string;
  contact_id: string;
  kind: MemoryKind;
  content: string | null;
  question: string | null;
  answer: string | null;
  source_preparation_id: string | null;
  pinned_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryDraft {
  contact_id: string;
  kind: MemoryKind;
  content?: string;
  question?: string;
  answer?: string;
  source_preparation_id?: string | null;
}

export function useContactBriefingMemory(contactIds: string[] | string | null | undefined) {
  const ids = Array.isArray(contactIds) ? contactIds : contactIds ? [contactIds] : [];
  const idsKey = ids.slice().sort().join(",");
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [items, setItems] = useState<ContactBriefingMemoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentTenant || ids.length === 0) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contact_briefing_memory")
        .select("id, tenant_id, contact_id, kind, content, question, answer, source_preparation_id, pinned_by, created_at, updated_at")
        .eq("tenant_id", currentTenant.id)
        .in("contact_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as ContactBriefingMemoryItem[]);
    } catch (e) {
      debugConsole.error("Error loading contact briefing memory:", e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.id, idsKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (draft: MemoryDraft) => {
      if (!currentTenant) return null;
      const payload = {
        tenant_id: currentTenant.id,
        contact_id: draft.contact_id,
        kind: draft.kind,
        content: draft.content ?? null,
        question: draft.question ?? null,
        answer: draft.answer ?? null,
        source_preparation_id: draft.source_preparation_id ?? null,
        pinned_by: user?.id ?? null,
      };
      const { error } = await supabase.from("contact_briefing_memory").insert(payload);
      if (error) {
        debugConsole.error("Error adding memory:", error);
        return null;
      }
      await refresh();
      return true;
    },
    [currentTenant, user?.id, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("contact_briefing_memory").delete().eq("id", id);
      if (error) {
        debugConsole.error("Error removing memory:", error);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<ContactBriefingMemoryItem, "content" | "question" | "answer">>) => {
      const { error } = await supabase
        .from("contact_briefing_memory")
        .update(patch)
        .eq("id", id);
      if (error) {
        debugConsole.error("Error updating memory:", error);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh],
  );

  return { items, loading, refresh, add, remove, update };
}
