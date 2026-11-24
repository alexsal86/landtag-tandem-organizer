import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

/**
 * Offene Freigaben der Redaktion: Beiträge im Zustand "Angefragt" (pending_approval)
 * im aktiven Team. Wird im Redaktions-Tab und auf dem Dashboard als Zähler genutzt.
 */
export function useOpenApprovalCount() {
  const { currentTenant } = useTenant();
  const [openApprovals, setOpenApprovals] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenant?.id) {
      setOpenApprovals(0);
      setIsError(false);
      return;
    }

    setLoading(true);
    const { count, error } = await supabase
      .from("social_content_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", currentTenant.id)
      .eq("approval_state", "pending_approval");

    if (error) {
      setIsError(true);
    } else {
      setOpenApprovals(count ?? 0);
      setIsError(false);
    }
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const uniqueChannelId = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!currentTenant?.id) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        void loadRef.current();
      }, 250);
    };

    const channel = supabase
      .channel(`open-approvals-${currentTenant.id}-${uniqueChannelId.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_content_items", filter: `tenant_id=eq.${currentTenant.id}` },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id]);

  return { openApprovals, loading, isError, refresh: load };
}
