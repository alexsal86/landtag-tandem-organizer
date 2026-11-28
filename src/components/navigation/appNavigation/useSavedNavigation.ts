import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { isNavigationModuleAllowed, isSavedRouteAllowed, type NavigationAccess } from "../navigationConfig";

import { savedObjectReference } from "@/lib/quickAccessTargets";
import { MY_WORK_TABS, LEGACY_TAB_MAP } from "@/components/my-work/myWorkTabs";
import { canViewTab } from "@/components/my-work/tabVisibility";
import { useTenantModuleGate } from "@/hooks/useTenantFeatureFlag";

type SavedTarget = { id: string; route: string; type?: "page" | "item" };

/** Existing browser-local pins may predate tenant metadata. Check referenced rows with current RLS. */
export function useSavedNavigation<T extends SavedTarget>(entries: T[], access: NavigationAccess, enabled: boolean) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const moduleEnabled = useTenantModuleGate(false);
  const allowed = entries.filter(entry => {
    if (!isSavedRouteAllowed(entry.route, access) || !isNavigationModuleAllowed(entry.route, moduleEnabled)) return false;
    const url = new URL(entry.route, "https://app.invalid");
    const rawTab = url.searchParams.get("tab");
    if (url.pathname.startsWith("/letters/") || (url.pathname === "/documents" && rawTab === "letters")) return moduleEnabled("module.letters");
    if (url.pathname === "/mywork" && rawTab) {
      const tab = MY_WORK_TABS.find(item => item.value === (LEGACY_TAB_MAP[rawTab] ?? rawTab));
      return (!tab || canViewTab(tab, access.role)) && (tab?.value !== "redaktion" || moduleEnabled("module.editorial"));
    }
    return true;
  });
  const refs = allowed.map(entry => ({ entry, ref: savedObjectReference(entry.route) }));
  const idsByTable = new Map<NonNullable<ReturnType<typeof savedObjectReference>>["table"], Set<string>>();
  for (const { ref } of refs) {
    if (!ref) continue;
    const ids = idsByTable.get(ref.table) ?? new Set<string>();
    ids.add(ref.id);
    idsByTable.set(ref.table, ids);
  }
  const references = [...idsByTable].map(([table, ids]) => [table, [...ids].sort()] as const).sort(([a], [b]) => a.localeCompare(b));
  const { data } = useQuery({
    queryKey: ["sidebar-saved-targets", tenantId, user?.id, references],
    enabled: enabled && !!tenantId && !!user?.id && references.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const groups = await Promise.all(references.map(async ([table, ids]) => {
        const { data } = await supabase.from(table).select("id").eq("tenant_id", tenantId!).in("id", ids);
        return (data ?? []).map(row => `${table}:${row.id}`);
      }));
      return groups.flat();
    },
  });

  return refs.filter(({ entry, ref }) => ref
    ? data?.includes(`${ref.table}:${ref.id}`)
    : entry.type !== "item" || entry.route.startsWith("/mywork?tab=") || entry.route.startsWith("/dossiers?tab=")
  ).map(({ entry }) => entry);
}
