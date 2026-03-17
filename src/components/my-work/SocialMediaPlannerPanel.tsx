import { useEffect, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarClock, Link2, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Badge } from "@/components/ui/badge";

interface ContentItem {
  id: string;
  hook: string | null;
  core_message: string | null;
  workflow_status: string;
  scheduled_for: string | null;
  topic_backlog: {
    topic: string;
  } | null;
  social_content_item_channels: {
    social_content_channels: {
      name: string;
    } | null;
  }[];
}

interface Props {
  refreshToken?: number;
}

export function SocialMediaPlannerPanel({ refreshToken = 0 }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContentItem[]>([]);

  const loadItems = async () => {
    if (!user?.id || !currentTenant?.id) return;

    setLoading(true);
    const { data } = await supabase
      .from("social_content_items")
      .select(`
        id,
        hook,
        core_message,
        workflow_status,
        scheduled_for,
        topic_backlog:topic_backlog_id (topic),
        social_content_item_channels (
          social_content_channels:channel_id (name)
        )
      `)
      .eq("tenant_id", currentTenant.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setItems((data ?? []) as ContentItem[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadItems();
  }, [user?.id, currentTenant?.id, refreshToken]);

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Social-Media-Planer</h3>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lade Redaktionsplanung…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Beiträge geplant.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{item.hook ?? item.core_message ?? "Unbenannter Beitrag"}</p>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Link2 className="h-3 w-3" />
                    Ursprung: {item.topic_backlog?.topic ?? "unbekannt"}
                  </div>
                </div>
                <Badge variant="outline">{item.workflow_status}</Badge>
              </div>

              <div className="flex flex-wrap gap-1">
                {item.social_content_item_channels.map((entry, index) => (
                  <Badge key={`${item.id}-channel-${index}`} variant="secondary" className="text-[10px]">
                    {entry.social_content_channels?.name ?? "Kanal"}
                  </Badge>
                ))}
              </div>

              {item.scheduled_for && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {format(new Date(item.scheduled_for), "dd.MM.yyyy HH:mm", { locale: de })} Uhr
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
