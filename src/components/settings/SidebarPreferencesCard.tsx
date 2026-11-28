import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SIDEBAR_MODE_PREF_KEY, SHOW_RECENT_PREF_KEY, sidebarMode, type SidebarMode } from "@/components/navigation/appNavigation/sidebarMode";
import { PanelLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUserPreference } from "@/hooks/useUserPreference";

export function SidebarPreferencesCard() {
  const [showRecent, setShowRecent] = useUserPreference<boolean>(SHOW_RECENT_PREF_KEY, false);
  const [mode, setMode] = useUserPreference<SidebarMode>(SIDEBAR_MODE_PREF_KEY, "normal");
  return (
    <Card className="bg-card shadow-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PanelLeft className="h-5 w-5 text-primary" />
          Seitenleiste
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label htmlFor="sidebar-mode">Sidebar-Modus</Label>
          <Select value={sidebarMode(mode)} onValueChange={value => setMode(sidebarMode(value))}>
            <SelectTrigger id="sidebar-mode" className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="compact">Kompakt</SelectItem>
              <SelectItem value="ghost">Ghost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="sidebar-show-recent">„Kürzlich besucht" anzeigen</Label>
            <p className="text-sm text-muted-foreground mt-1">Zeigt Ihre zuletzt geöffneten Seiten unter dem Schnellzugriff.</p>
          </div>
          <Switch id="sidebar-show-recent" checked={showRecent === true} onCheckedChange={(v) => setShowRecent(v)} />
        </div>
      </CardContent>
    </Card>
  );
}
