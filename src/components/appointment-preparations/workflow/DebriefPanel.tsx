import { Link } from "react-router-dom";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Smile, Meh, Frown, ListPlus, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { notify } from "@/lib/notify";

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
  task_id?: string;
}

export function DebriefPanel({ preparation, appointmentId, onUpdate }: DebriefPanelProps) {
  const { user } = useAuth();
  const { users } = useTenantUsers();
  const [creating, setCreating] = useState<string | null>(null);
  const data = preparation.preparation_data ?? {};
  const [summary, setSummary] = useState(data.debrief_summary ?? "");
  const [outcomes, setOutcomes] = useState(data.debrief_outcomes ?? "");
  const [mood, setMood] = useState<Mood | undefined>(data.debrief_mood);
  const [openPoints, setOpenPoints] = useState<OpenPoint[]>(data.debrief_open_points ?? []);
  const [followupScheduled, setFollowupScheduled] = useState(data.debrief_followup_scheduled ?? false);
  const [followupTaskId, setFollowupTaskId] = useState(data.debrief_followup_task_id);
  const [saving, setSaving] = useState(false);

  const persist = async (overrides: Partial<typeof data> = {}) => {
    const next = {
      ...preparation.preparation_data,
      debrief_summary: summary,
      debrief_outcomes: outcomes,
      debrief_mood: mood,
      debrief_open_points: openPoints,
      debrief_followup_scheduled: followupScheduled,
      debrief_followup_task_id: followupTaskId,
      ...overrides,
    };
    await onUpdate({ preparation_data: next });
  };

  const addPoint = () => {
    const next = [...openPoints, { id: crypto.randomUUID(), text: "" }];
    setOpenPoints(next);
    void persist({ debrief_open_points: next });
  };
  const updatePoint = (id: string, patch: Partial<OpenPoint>) => {
    setOpenPoints((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const removePoint = (id: string) => {
    const next = openPoints.filter(p => p.id !== id);
    setOpenPoints(next);
    void persist({ debrief_open_points: next });
  };

  const createTaskFromPoint = async (point: OpenPoint) => {
    if (!user || !point.text.trim() || creating || point.task_id) return;
    setCreating(point.id);
    try {
      await persist();
      const { data: taskId, error } = await supabase.rpc("create_preparation_followup", { _preparation_id: preparation.id, _point_id: point.id });
      if (error) throw error;
      const next = openPoints.map(p => p.id === point.id ? { ...p, task_created: true, task_id: taskId } : p);
      setOpenPoints(next);
      await onUpdate({});
      notify.success("Aufgabe erstellt");
    } catch (e) {
      notify.error("Fehler", { description: "Aufgabe konnte nicht erstellt werden."
});
    } finally { setCreating(null); }
  };

  const scheduleFollowupReminder = async () => {
    if (!user) return;
    try {
      if (creating) return;
      setCreating("followup");
      await persist();
      const { data: taskId, error } = await supabase.rpc("create_preparation_followup", { _preparation_id: preparation.id });
      if (error) throw error;
      setFollowupScheduled(true);
      setFollowupTaskId(taskId);
      await onUpdate({});
      notify.success("Erfolgs-Check vier Wochen nach Termin geplant");
    } catch (e) {
      notify.error("Fehler", { description: "Reminder konnte nicht erstellt werden."
});
    } finally { setCreating(null); }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await persist();
      notify.success("Nachbereitung gespeichert");
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
                  <select aria-label="Verantwortliche Person" value={point.assignee ?? user?.id ?? ""} onChange={e => { updatePoint(point.id, { assignee: e.target.value }); void persist({ debrief_open_points: openPoints.map(p => p.id === point.id ? { ...p, assignee: e.target.value } : p) }); }}><option value="">Person wählen</option>{users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}</select>
                  {point.task_id ? (<Link to={`/tasks?highlight=${point.task_id}`}>Aufgabe öffnen</Link>) : point.task_created ? (
                    <span className="text-xs inline-flex items-center px-2 py-1 rounded bg-palette-green/10 text-palette-green">
                      ✓ Aufgabe erstellt
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" disabled={!!creating} onClick={() => createTaskFromPoint(point)}>
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
            <p className="text-sm text-palette-green">✓ Erfolgs-Check vier Wochen nach Termin ist geplant.</p>
          ) : (
            <Button disabled={!!creating || !appointmentId} variant="outline" size="sm" onClick={scheduleFollowupReminder}>
              Vier Wochen nach Termin erinnern: „Hat das stattgefunden?"
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
