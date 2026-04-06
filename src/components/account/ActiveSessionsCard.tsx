import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Tablet, Globe, LogOut, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { debugConsole } from "@/utils/debugConsole";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type UserSession = Database["public"]["Tables"]["user_sessions"]["Row"];
type SessionDeviceDescriptor = { icon: typeof Monitor; label: string };

function parseDeviceInfo(ua: string | null): SessionDeviceDescriptor {
  if (!ua) return { icon: Globe, label: "Unbekanntes Gerät" };
  const lower = ua.toLowerCase();

  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
    return { icon: Smartphone, label: "Mobilgerät" };
  }
  if (lower.includes("ipad") || lower.includes("tablet")) {
    return { icon: Tablet, label: "Tablet" };
  }

  let browser = "Browser";
  if (lower.includes("chrome") && !lower.includes("edg")) browser = "Chrome";
  else if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("safari") && !lower.includes("chrome")) browser = "Safari";
  else if (lower.includes("edg")) browser = "Edge";

  let os = "";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac")) os = "macOS";
  else if (lower.includes("linux")) os = "Linux";

  return { icon: Monitor, label: `${browser}${os ? ` auf ${os}` : ""}` };
}

export function ActiveSessionsCard(): React.JSX.Element {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  const loadSessions = async (): Promise<void> => {
    if (!user?.id) {
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      // Cleanup: delete sessions older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      await supabase
        .from("user_sessions")
        .delete()
        .eq("user_id", user.id)
        .lt("last_active_at", thirtyDaysAgo.toISOString());

      const { data, error } = await supabase
        .from("user_sessions")
        .select("id, device_info, ip_address, last_active_at, created_at, is_current")
        .eq("user_id", user.id)
        .order("last_active_at", { ascending: false })
        .limit(10)
        .returns();

      if (error) throw error;
      setSessions(data ?? []);
    } catch (error: unknown) {
      debugConsole.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect((): void => {
    void loadSessions();
  }, [user?.id]);

  const handleLogoutAll = async (): Promise<void> => {
    setLoggingOut(true);
    try {
      const { error } = await supabase.functions.invoke("global-logout", {
        method: "POST",
      });

      if (error) throw error;

      toast({
        title: "Abgemeldet",
        description: "Sie wurden von allen anderen Geräten abgemeldet.",
      });

      await loadSessions();
    } catch (error: unknown) {
      toast({
        title: "Fehler",
        description: `Abmeldung fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
        variant: "destructive",
      });
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Aktive Sitzungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Laden...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Aktive Sitzungen ({sessions.length})
          </span>
          {sessions.length > 1 && (
            <Button variant="destructive" size="sm" onClick={handleLogoutAll} disabled={loggingOut}>
              <LogOut className="h-3.5 w-3.5 mr-1" />
              {loggingOut ? "Abmelden..." : "Von allen abmelden"}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine aktiven Sitzungen gefunden.</p>
        ) : (
          sessions.map((session: UserSession) => {
            const device = parseDeviceInfo(session.device_info);
            const DeviceIcon = device.icon;
            const lastActiveAt = session.last_active_at ? new Date(session.last_active_at) : null;
            const createdAt = session.created_at ? new Date(session.created_at) : null;

            return (
              <div key={session.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <DeviceIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{device.label}</span>
                    {session.is_current && (
                      <Badge variant="secondary" className="text-xs">
                        Aktuelle Sitzung
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Zuletzt aktiv: {lastActiveAt ? formatDistanceToNow(lastActiveAt, { addSuffix: true, locale: de }) : "Unbekannt"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Angemeldet: {createdAt ? format(createdAt, "dd.MM.yyyy HH:mm", { locale: de }) : "Unbekannt"}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
