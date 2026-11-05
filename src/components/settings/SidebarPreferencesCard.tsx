import { PanelLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUserPreference } from "@/hooks/useUserPreference";

export const SHOW_RECENT_PREF_KEY = "sidebar_show_recent_v1";

export function SidebarPreferencesCard() {
  const [showRecent, setShowRecent] = useUserPreference<boolean>(SHOW_RECENT_PREF_KEY, false);
  return (
    <Card className="bg-card shadow-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PanelLeft className="h-5 w-5 text-primary" />
          Seitenleiste
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="sidebar-show-recent">„Kürzlich besucht" anzeigen</Label>
            <p className="text-sm text-muted-foreground mt-1">Zeigt Ihre zuletzt geöffneten Seiten unten in der Seitenleiste.</p>
          </div>
          <Switch id="sidebar-show-recent" checked={showRecent === true} onCheckedChange={(v) => setShowRecent(v)} />
        </div>
      </CardContent>
    </Card>
  );
}
