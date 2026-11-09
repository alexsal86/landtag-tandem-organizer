import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileText, Bell } from "lucide-react";

interface Health {
  users: number;
  case_file_types: number;
  letter_templates: number;
  meeting_templates: number;
  notification_types: number;
  sender_information: number;
  app_settings: number;
}

interface Props {
  tenantId: string;
  reloadKey?: number;
}

export function TenantHealthBadges({ tenantId, reloadKey }: Props): React.JSX.Element {
  const { data, isLoading: loading, isError } = useQuery({
    queryKey: ["platform-tenant-health", reloadKey],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_tenant_health");
      if (error) throw error;
      return data as unknown as Record<string, Health>;
    },
    staleTime: 60_000,
  });
  const health = data?.[tenantId];
  if (isError) return <span role="alert" className="text-xs text-destructive">Status nicht verfügbar</span>;

  if (loading) {
    return <span className="text-xs text-muted-foreground">…</span>;
  }
  if (!health) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const templates =
    health.case_file_types + health.letter_templates + health.meeting_templates;

  const tone = (n: number) =>
    n === 0
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : n < 5
      ? "bg-palette-amber/10 text-palette-amber border-palette-amber/30"
      : "bg-palette-green/10 text-palette-green border-palette-green/30";

  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline" className={`gap-1 text-xs ${tone(health.users)}`}>
        <Users className="h-3 w-3" />
        {health.users}
      </Badge>
      <Badge variant="outline" className={`gap-1 text-xs ${tone(templates)}`}>
        <FileText className="h-3 w-3" />
        {templates}
      </Badge>
      <Badge variant="outline" className={`gap-1 text-xs ${tone(health.notification_types)}`}>
        <Bell className="h-3 w-3" />
        {health.notification_types}
      </Badge>
    </div>
  );
}
