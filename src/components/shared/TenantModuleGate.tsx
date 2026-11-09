import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useTenantFeatureFlag } from "@/hooks/useTenantFeatureFlag";
import { useTenant } from "@/hooks/useTenant";
import { MODULE_ROUTES } from "@/lib/tenant-modules";
export function TenantModuleGate({ children }: { children: ReactNode }) {
  const location = useLocation(); const { currentTenant } = useTenant();
  const queryClient = useQueryClient(); const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!currentTenant?.id) return;
    const refresh = () => { queryClient.clear(); setRevision(value => value + 1); };
    const channel = supabase.channel(`permission-refresh:${currentTenant.id}`);
    for (const table of ['field_permissions', 'action_permissions', 'tenant_feature_flags']) channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `tenant_id=eq.${currentTenant.id}` }, refresh);
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentTenant?.id, queryClient]);
  const content = <div key={`${currentTenant?.id ?? ''}:${revision}`} className="contents">{children}</div>;
  const key = MODULE_ROUTES[decodeURIComponent(location.pathname.split('/')[1] ?? '')];
  const { enabled, isLoading } = useTenantFeatureFlag(key ?? '__unrestricted__');
  if (!key) return content;
  if (isLoading) return <p role="status">Moduleinstellungen werden geladen…</p>;
  if (!currentTenant || !enabled) return <main className="p-6"><h1 className="text-xl font-semibold">Modul nicht verfügbar</h1><p>Dieses Modul ist für das aktuelle Büro ausgeblendet oder die Einstellungen sind nicht erreichbar.</p><a href="/mywork">Zurück zu Meine Arbeit</a></main>;
  return content;
}
