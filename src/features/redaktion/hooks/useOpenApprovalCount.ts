import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

/**
 * Offene Freigaben der Redaktion: Beiträge im Zustand "Angefragt" (pending_approval)
 * im aktiven Team.
 *
 * Der Zähler lebt zentral in diesem Modul: Egal wie viele Stellen ihn anzeigen
 * (Redaktions-Tab, Dashboard-Karte), es läuft genau eine Abfrage und genau ein
 * Realtime-Abo. Der letzte abgemeldete Verbraucher beendet beides wieder.
 */
interface ApprovalCountSnapshot {
  tenantId: string | null;
  openApprovals: number;
  loading: boolean;
  isError: boolean;
}

const EMPTY_SNAPSHOT: ApprovalCountSnapshot = {
  tenantId: null,
  openApprovals: 0,
  loading: false,
  isError: false,
};

let snapshot: ApprovalCountSnapshot = EMPTY_SNAPSHOT;
let consumers = 0;
let activeTenantId: string | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

function emit(next: Partial<ApprovalCountSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

async function loadCount(tenantId: string) {
  const { count, error } = await supabase
    .from("social_content_items")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("approval_state", "pending_approval");

  // Team gewechselt oder alle Verbraucher abgemeldet: Antwort verwerfen.
  if (activeTenantId !== tenantId) return;

  if (error) {
    emit({ tenantId, loading: false, isError: true });
    return;
  }
  emit({ tenantId, openApprovals: count ?? 0, loading: false, isError: false });
}

function scheduleRefresh() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    if (activeTenantId) void loadCount(activeTenantId);
  }, 250);
}

function teardown() {
  if (debounce) {
    clearTimeout(debounce);
    debounce = null;
  }
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  activeTenantId = null;
}

function acquire(tenantId: string) {
  consumers += 1;
  if (activeTenantId === tenantId && channel) return;

  teardown();
  activeTenantId = tenantId;
  emit({ tenantId, openApprovals: 0, loading: true, isError: false });

  channel = supabase
    .channel(`open-approvals-${tenantId}-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "social_content_items", filter: `tenant_id=eq.${tenantId}` },
      scheduleRefresh,
    )
    .subscribe();

  void loadCount(tenantId);
}

function release() {
  consumers = Math.max(0, consumers - 1);
  if (consumers > 0) return;

  teardown();
  emit(EMPTY_SNAPSHOT);
}

export function useOpenApprovalCount() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!tenantId) return;
    acquire(tenantId);
    return () => release();
  }, [tenantId]);

  const refresh = useCallback(() => {
    if (tenantId) void loadCount(tenantId);
  }, [tenantId]);

  const isCurrentTenant = tenantId !== null && state.tenantId === tenantId;

  return {
    openApprovals: isCurrentTenant ? state.openApprovals : 0,
    loading: isCurrentTenant ? state.loading : false,
    isError: isCurrentTenant ? state.isError : false,
    refresh,
  };
}
