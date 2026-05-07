import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Smile, Meh, Frown, ListPlus, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";

interface DebriefPanelProps {
  preparation: AppointmentPreparation;
  appointmentId?: string | null;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

type Mood = "positive" | "neutral" | "negative";

interface OpenPoint {
  id: string;
  text: string;
  assignee?: string;
  due_date?: string;
  task_created?: boolean;
}

export function DebriefPanel({ preparation, appointmentId, onUpdate }: DebriefPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const data = preparation.preparation_data ?? {};
  const [summary, setSummary] = useState(data.debrief_summary ?? "");
  const [outcomes, setOutcomes] = useState(data.debrief_outcomes ?? "");
  const [mood, setMood] = useState<Mood | undefined>(data.debrief_mood);
  const [openPoints, setOpenPoints] = useState<OpenPoint[]>(data.debrief_open_points ?? []);
  const [followupScheduled, setFollowupScheduled] = useState(data.debrief_followup_scheduled ?? false);
  const [saving, setSaving] = useState(false);

  const persist = async (overrides: Partial<typeof data> = {}) => {
    const next = {
      ...preparation.preparation_data,
      debrief_summary: summary,
      debrief_outcomes: outcomes,
      debrief_mood: mood,
      debrief_open_points: openPoints,
      debrief_followup_scheduled: followupScheduled,
      ...overrides,
    };
    await onUpdate({ preparation_data: next });
  };

  const addPoint = () => {
    const next = [...openPoints, { id: crypto.randomUUID(), text: "" }];
    setOpenPoints(next);
  };
  const updatePoint = (id: string, patch: Partial<OpenPoint>) => {
    setOpenPoints((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const removePoint = (id: string) => {
    setOpenPoints((prev) => prev.filter((p) => p.id !== id));
  };

  const createTaskFromPoint = async (point: OpenPoint) => {
    if (!user || !point.text.trim()) return;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await supabase.from("tasks").insert({
        title: point.text.slice(0, 200),
        description: `Aus Nachbereitung: ${preparation.title}`,
        tenant_id: preparation.tenant_id,
        created_by: profile?.id ?? user.id,
        assigned_to: point.assignee ?? user.id,
        due_date: point.due_date ?? null,
        status: "open",
        priority: "medium",
      });
      if (error) throw error;

      updatePoint(point.id, { task_created: true });
      const next = openPoints.map((p) => (p.id === point.id ? { ...p, task_created: true } : p));
      await persist({ debrief_open_points: next });
      toast({ title: "Aufgabe erstellt" });
    } catch (e) {
      toast({ title: "Fehler", description: "Aufgabe konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const scheduleFollowupReminder = async () => {
    if (!user || !appointmentId) return;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 28);

      const { error } = await supabase.from("tasks").insert({
        title: `Erfolgs-Check: ${preparation.title}`,
        description: "Hat das vereinbarte Ergebnis stattgefunden? (Auto-Reminder 4 Wochen nach Termin)",
        tenant_id: preparation.tenant_id,
        created_by: profile?.id ?? user.id,
        assigned_to: user.id,
        due_date: dueDate.toISOString().slice(0, 10),
        status: "open",
        priority: "low",
      });
      if (error) throw error;
      setFollowupScheduled(true);
      await persist({ debrief_followup_scheduled: true });
      toast({ title: "Erfolgs-Check in 4 Wochen geplant" });
    } catch (e) {
      toast({ title: "Fehler", description: "Reminder konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await persist();
      toast({ title: "Nachbereitung gespeichert" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Was wurde besprochen?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="debrief-summary">Zusammenfassung</Label>
            <Textarea
              id="debrief-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onBlur={() => persist()}
              rows={4}
              placeholder="Worum ging es? Wer war anwesend, welche Stimmung?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="debrief-outcomes">Ergebnisse / Vereinbarungen</Label>
            <Textarea
              id="debrief-outcomes"
              value={outcomes}
              onChange={(e) => setOutcomes(e.target.value)}
              onBlur={() => persist()}
              rows={3}
              placeholder="Was wurde vereinbart? Wer macht was?"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Stimmung</Label>
            <div className="flex gap-2">
              {([
                { v: "positive", icon: Smile, label: "Positiv" },
                { v: "neutral", icon: Meh, label: "Neutral" },
                { v: "negative", icon: Frown, label: "Schwierig" },
              ] as const).map(({ v, icon: Icon, label }) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => { setMood(v); persist({ debrief_mood: v }); }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors",
                    mood === v ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50",
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListPlus className="h-4 w-4" />
            Offene Punkte → Aufgaben
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {openPoints.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine offenen Punkte erfasst.</p>
          )}
          {openPoints.map((point) => (
            <div key={point.id} className="flex items-start gap-2 rounded-md border p-3">
              <div className="flex-1 space-y-2">
                <Input
                  value={point.text}
                  onChange={(e) => updatePoint(point.id, { text: e.target.value })}
                  onBlur={() => persist()}
                  placeholder="Was muss noch passieren?"
                />
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={point.due_date ?? ""}
                    onChange={(e) => updatePoint(point.id, { due_date: e.target.value })}
                    onBlur={() => persist()}
                    className="w-44"
                  />
                  {point.task_created ? (
                    <span className="text-xs inline-flex items-center px-2 py-1 rounded bg-emerald-500/10 text-emerald-700">
                      ✓ Aufgabe erstellt
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => createTaskFromPoint(point)}>
                      Aufgabe erstellen
                    </Button>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { removePoint(point.id); }} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addPoint}>
            <Plus className="h-4 w-4 mr-1.5" /> Offenen Punkt hinzufügen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="h-4 w-4" />
            Erfolgs-Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          {followupScheduled ? (
            <p className="text-sm text-emerald-700">✓ Reminder in 4 Wochen ist geplant.</p>
          ) : (
            <Button variant="outline" size="sm" onClick={scheduleFollowupReminder}>
              In 4 Wochen erinnern: „Hat das stattgefunden?"
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveAll} disabled={saving}>
          Nachbereitung speichern
        </Button>
      </div>
    </div>
  );
}
