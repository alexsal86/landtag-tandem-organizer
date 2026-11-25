import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RlsGap {
  table_name: string;
  severity: "critical" | "warning" | "ok";
  reason: string;
  has_tenant_id: boolean;
  policy_count: number;
}

export interface RlsPolicy {
  table_name: string;
  policy_name: string;
  command: string;
  roles: string[];
  permissive: string;
  has_using: boolean;
  has_check: boolean;
}

export interface TableSecurity {
  table: string;
  gap?: RlsGap;
  policies: RlsPolicy[];
}

/**
 * Ordnet Befunde und Policies den Tabellen einer Funktion zu. Tabellen ohne
 * Befund oder ohne Policy bleiben mit leeren Werten erhalten; Einträge zu
 * fremden Tabellen werden nicht übernommen.
 */
export function groupSecurityByTable(
  tables: string[],
  gaps: RlsGap[],
  policies: RlsPolicy[],
): TableSecurity[] {
  return tables.map((table) => ({
    table,
    gap: gaps.find((gap) => gap.table_name === table),
    policies: policies.filter((policy) => policy.table_name === table),
  }));
}

/**
 * Live-Sicherheitsdaten für die Tabellen einer Funktion.
 * Die Befunde stammen aus demselben RPC wie das Security-Cockpit und ersetzen
 * weder eine Sicherheitsbewertung der Funktion noch ein funktionales Testergebnis.
 */
export function useTableSecurity(tables: string[]) {
  const enabled = tables.length > 0;

  const gapsQuery = useQuery({
    queryKey: ["rls_gaps"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_rls_gaps");
      if (error) throw error;
      return (data ?? []) as RlsGap[];
    },
    staleTime: 60_000,
    enabled,
  });

  const policiesQuery = useQuery({
    queryKey: ["rls_policies", [...tables].sort().join(",")],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_rls_policies", { _tables: tables });
      if (error) throw error;
      return (data ?? []) as RlsPolicy[];
    },
    staleTime: 60_000,
    enabled,
  });

  return { gapsQuery, policiesQuery };
}
