import { useEffect, useState } from "react";
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
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("manage-tenant-user", {
        body: { action: "getTenantHealth", tenantId },
      });
      if (!cancelled) {
        if (!error && data?.success) {
          setHealth(data.health);
        }
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tenantId, reloadKey]);

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
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";

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
