import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notify } from "@/lib/notify";

const KEY = "appointment-change-alerts";
const fmt = (d: string) => new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

function useAlerts() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: [KEY, tenantId],
    enabled: !!tenantId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 2 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("appointment_change_alerts")
        .select("id, title, message, created_by_name, created_at, acknowledged_at")
        .eq("tenant_id", tenantId ?? "")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Rotes Eil-Banner für den Abgeordneten mit „Verstanden“. */
export function AppointmentChangeBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useAlerts();
  const open = data.filter((a) => !a.acknowledged_at);
  if (!open.length) return null;
  const ack = async (id: string) => {
    const { error } = await supabase.from("appointment_change_alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id ?? "" }).eq("id", id);
    if (error) return notify.error("Konnte nicht bestätigt werden");
    qc.invalidateQueries({ queryKey: [KEY] });
  };
  return (
    <div className="space-y-2">
      {open.map((a) => (
        <div key={a.id} role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-destructive">{a.title}</p>
            <p className="text-sm text-foreground">{a.message} · von {a.created_by_name ?? "Büro"}, {fmt(a.created_at)}</p>
          </div>
          <Button size="sm" variant="destructive" onClick={() => ack(a.id)}>Verstanden</Button>
        </div>
      ))}
    </div>
  );
}

/** Büro: Eil-Änderung senden + Lesebestätigungen sehen. */
export function AppointmentChangeSender() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useAlerts();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const send = async () => {
    if (!currentTenant?.id || !user || !title.trim() || !message.trim()) return;
    const name = (user.user_metadata?.display_name as string | undefined) ?? user.email ?? null;
    const { error } = await supabase.from("appointment_change_alerts").insert({
      tenant_id: currentTenant.id, title: title.trim(), message: message.trim(), created_by: user.id, created_by_name: name,
    });
    if (error) return notify.error("Eil-Änderung konnte nicht gesendet werden");
    notify.success("Eil-Änderung an den Abgeordneten gesendet");
    setOpen(false); setTitle(""); setMessage("");
    qc.invalidateQueries({ queryKey: [KEY] });
  };
  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Zap className="mr-1 h-4 w-4" />Eil-Terminänderung melden</Button>
      {data.slice(0, 3).map((a) => (
        <p key={a.id} className="text-caption text-muted-foreground">
          {a.title} – {a.acknowledged_at ? `Gelesen ${fmt(a.acknowledged_at)}` : "noch nicht gelesen"}
        </p>
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eil-Terminänderung an Abgeordneten</DialogTitle></DialogHeader>
          <Input placeholder="z. B. Zeit geändert: Bürgerdialog Mobilität" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="z. B. Beginn jetzt 18:30 statt 18:00 · Raum 2 im Bürgerhaus" value={message} onChange={(e) => setMessage(e.target.value)} />
          <DialogFooter><Button onClick={send} disabled={!title.trim() || !message.trim()}>Senden</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
