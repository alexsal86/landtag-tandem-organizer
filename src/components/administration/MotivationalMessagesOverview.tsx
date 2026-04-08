import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RotateCcw, Save, Search } from "lucide-react";
import {
  DASHBOARD_MESSAGES_SETTING_KEY,
  messages as defaultMessages,
  parseDashboardMessagesSetting,
  type DashboardMessage
} from "@/utils/dashboard/messageGenerator";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { debugConsole } from "@/utils/debugConsole";

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: "Morgens (6–11)",
  midday: "Mittags (11–14)",
  afternoon: "Nachmittags (14–17)",
  evening: "Abends (17–21)",
  night: "Nachts (21–6)",
};

const VARIANT_LABELS: Record<string, { label: string; className: string }> = {
  motivational: { label: "Motivierend", className: "bg-sky-500/10 text-sky-700 border-sky-500/30" },
  encouraging: { label: "Ermutigend", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  relaxed: { label: "Entspannt", className: "bg-violet-500/10 text-violet-700 border-violet-500/30" },
  celebration: { label: "Feierlich", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  warning: { label: "Warnung", className: "bg-red-500/10 text-red-700 border-red-500/30" },
};

const DAY_LABELS: Record<number, string> = {
  0: "Sonntag",
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
  6: "Samstag",
};

const MONTH_LABELS: Record<number, string> = {
  1: "Januar", 2: "Februar", 3: "März", 4: "April", 5: "Mai", 6: "Juni",
  7: "Juli", 8: "August", 9: "September", 10: "Oktober", 11: "November", 12: "Dezember",
};

function describeTrigger(msg: DashboardMessage): string {
  const parts: string[] = [];

  parts.push(`Zeitfenster: ${TIME_SLOT_LABELS[msg.timeSlot] || msg.timeSlot}`);

  if (msg.dayOfWeek !== undefined) {
    parts.push(`Wochentag: ${DAY_LABELS[msg.dayOfWeek] || msg.dayOfWeek}`);
  }

  if (msg.isHoliday) {
    parts.push("Nur an Feiertagen");
  }

  if (msg.seasonalMonth !== undefined) {
    const months = Array.isArray(msg.seasonalMonth) ? msg.seasonalMonth : [msg.seasonalMonth];
    parts.push(`Monate: ${months.map(m => MONTH_LABELS[m] || m).join(", ")}`);
  }

  if (msg.conditions) {
    const c = msg.conditions;
    if (c.minAppointments !== undefined) parts.push(`Mind. ${c.minAppointments} Termine`);
    if (c.maxAppointments !== undefined) parts.push(`Max. ${c.maxAppointments} Termine`);
    if (c.taskThreshold !== undefined) parts.push(`Mind. ${c.taskThreshold} Aufgaben`);
    if (c.completedTasks !== undefined) parts.push(`Mind. ${c.completedTasks} erledigte Aufgaben`);
    if (c.hasPlenum) parts.push("Plenum-Tag");
    if (c.hasCommittee) parts.push("Ausschuss-Tag");
    if (c.multipleSessions) parts.push("Mehrere Sitzungen");
  }

  return parts.join(" · ");
}

export function MotivationalMessagesOverview() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [variantFilter, setVariantFilter] = useState("all");
  const [timeSlotFilter, setTimeSlotFilter] = useState("all");
  const [messages, setMessages] = useState<DashboardMessage[]>(defaultMessages);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const query = supabase
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", DASHBOARD_MESSAGES_SETTING_KEY)
          .limit(1);

        const { data, error } = currentTenant?.id
          ? await query.eq("tenant_id", currentTenant.id).maybeSingle()
          : await query.is("tenant_id", null).maybeSingle();

        if (error) throw error;

        const parsed = parseDashboardMessagesSetting(data?.setting_value);
        setMessages(parsed ?? defaultMessages);
      } catch (error) {
        debugConsole.error("Error loading motivational messages:", error);
        toast({
          title: "Fehler",
          description: "Motivationssprüche konnten nicht geladen werden.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [currentTenant?.id, toast]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return messages.filter(msg => {
      if (q && !msg.text.toLowerCase().includes(q) && !msg.id.toLowerCase().includes(q)) return false;
      if (variantFilter !== "all" && msg.variant !== variantFilter) return false;
      if (timeSlotFilter !== "all" && msg.timeSlot !== timeSlotFilter) return false;
      return true;
    }).sort((a, b) => b.priority - a.priority);
  }, [search, variantFilter, timeSlotFilter]);

  const variants = useMemo(() => [...new Set(messages.map(m => m.variant).filter(Boolean))], [messages]);
  const timeSlots = useMemo(() => [...new Set(messages.map(m => m.timeSlot))], [messages]);

  const updateMessageText = (id: string, text: string) => {
    setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, text } : msg));
  };

  const handleReset = () => {
    setMessages(defaultMessages);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const tenantId = currentTenant?.id ?? null;
      const baseQuery = supabase
        .from("app_settings")
        .select("id")
        .eq("setting_key", DASHBOARD_MESSAGES_SETTING_KEY)
        .limit(1);

      const { data: existing, error: existingError } = tenantId
        ? await baseQuery.eq("tenant_id", tenantId).maybeSingle()
        : await baseQuery.is("tenant_id", null).maybeSingle();

      if (existingError) throw existingError;

      const settingValue = JSON.stringify(messages);
      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("app_settings")
          .update({ setting_value: settingValue })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("app_settings")
          .insert([{
            tenant_id: tenantId,
            setting_key: DASHBOARD_MESSAGES_SETTING_KEY,
            setting_value: settingValue,
          }]);
        if (insertError) throw insertError;
      }

      toast({ title: "Gespeichert", description: "Motivationssprüche wurden aktualisiert." });
    } catch (error) {
      debugConsole.error("Error saving motivational messages:", error);
      toast({
        title: "Fehler",
        description: "Motivationssprüche konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Motivationssprüche – Übersicht</CardTitle>
          <p className="text-sm text-muted-foreground">Lädt Einstellungen…</p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Motivationssprüche – Übersicht</CardTitle>
        <p className="text-sm text-muted-foreground">
          Alle {messages.length} konfigurierten Sprüche mit ihren Auslösebedingungen. Sprüche werden nach Priorität ausgewählt – der passendste gewinnt.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Speichern
          </Button>
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Standard wiederherstellen
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche in Sprüchen…" className="pl-9" />
          </div>
          <Select value={variantFilter} onValueChange={setVariantFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Variante" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Varianten</SelectItem>
              {variants.map(v => (
                <SelectItem key={v} value={v!}>{VARIANT_LABELS[v!]?.label || v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeSlotFilter} onValueChange={setTimeSlotFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Zeitfenster" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Zeitfenster</SelectItem>
              {timeSlots.map(ts => (
                <SelectItem key={ts} value={ts}>{TIME_SLOT_LABELS[ts] || ts}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">{filtered.length} von {messages.length} Sprüchen</p>

        <div className="space-y-2">
          {filtered.map(msg => {
            const vMeta = VARIANT_LABELS[msg.variant || "motivational"];
            return (
              <div key={msg.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <Textarea
                    value={msg.text}
                    onChange={(event) => updateMessageText(msg.id, event.target.value)}
                    className="min-h-[72px] text-sm"
                  />
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="outline" className={vMeta?.className}>
                      {vMeta?.label || msg.variant}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Prio {msg.priority}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{describeTrigger(msg)}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
