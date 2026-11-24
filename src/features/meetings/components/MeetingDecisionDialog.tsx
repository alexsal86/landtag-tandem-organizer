import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Scale } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/notify";
import { debugConsole } from "@/utils/debugConsole";
import { berlinDateTimeToInstant } from "@/utils/berlinDate";
import { addDecisionToNote, decisionSummary } from "@/features/meetings/meetingDecision";
import type { AgendaItem, Meeting } from "@/components/meetings/types";

interface Invitee {
  userId: string;
  name: string;
}

async function loadInvitees(meetingId: string): Promise<Invitee[]> {
  const { data: participants, error } = await supabase
    .from("meeting_participants")
    .select("user_id")
    .eq("meeting_id", meetingId)
    .limit(100);
  if (error) throw error;
  const ids = (participants ?? []).map((row) => row.user_id);
  if (ids.length === 0) return [];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", ids);
  if (profileError) throw profileError;
  return ids.map((userId) => ({
    userId,
    name: profiles?.find((profile) => profile.user_id === userId)?.display_name || "Unbekannt",
  }));
}

/** Ergebnis des Eintrags in den Entscheidungsblock der Agenda. */
export interface DecisionLinkResult {
  blockId: string | null;
  blockCreated: boolean;
  note: string;
}

/**
 * Erfasst einen Beschluss mitten in der Besprechung: Entscheidung anlegen,
 * Teilnehmende einladen und im Entscheidungsblock der Agenda verlinken.
 * Keine E-Mail, keine Matrix-Nachricht – die Beteiligten sehen sie im System.
 */
export function MeetingDecisionDialog({
  open,
  onOpenChange,
  meeting,
  item,
  onSaved,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting;
  item: AgendaItem | null;
  /** Nach dem Anlegen: Sitzungsansichten (Entscheidungsliste) neu laden. */
  onSaved?: () => void;
  /** Nach dem Verknüpfen: Ergebnisblock in der laufenden Agenda nachziehen. */
  onLinked?: (result: DecisionLinkResult) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const creationId = useRef(crypto.randomUUID());
  // Hält die bereits angelegte Entscheidung fest, damit „Erneut verlinken“
  // keinen zweiten Beschluss erzeugt.
  const createdRef = useRef<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [invited, setInvited] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const { data: invitees = [] } = useQuery({
    queryKey: ["meeting-decision-invitees", meeting.id, open],
    enabled: open && Boolean(meeting.id),
    staleTime: 60_000,
    queryFn: () => loadInvitees(meeting.id!),
  });

  const initializedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      createdRef.current = null;
      setLinkError(null);
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;
    creationId.current = crypto.randomUUID();
    createdRef.current = null;
    setLinkError(null);
    setTitle(item?.title ?? "");
    setDescription(item?.result_text ?? item?.description ?? "");
    setDeadline("");
    setInvited([]);
  }, [open, item?.title, item?.result_text, item?.description]);

  // Beteiligte einmalig vorbelegen, sobald die Teilnehmenden geladen sind.
  useEffect(() => {
    if (!open) return;
    setInvited((current) =>
      current.length > 0
        ? current
        : invitees.filter((invitee) => invitee.userId !== user?.id).map((invitee) => invitee.userId),
    );
  }, [open, invitees, user?.id]);

  /** Legt den Beschluss genau einmal an. */
  const createDecision = async (decisionId: string) => {
    if (!user?.id || !meeting.id || !meeting.tenant_id) throw new Error("Sitzung oder Mandant fehlt");

    const { error } = await supabase.from("task_decisions").insert({
      id: decisionId,
      title: title.trim(),
      description: description.trim() || null,
      created_by: user.id,
      tenant_id: meeting.tenant_id,
      status: "active",
      meeting_id: meeting.id,
      response_deadline: deadline ? berlinDateTimeToInstant(deadline).toISOString() : null,
      visible_to_all: true,
    });
    if (error) throw error;

    if (invited.length > 0) {
      const { error: inviteError } = await supabase.from("task_decision_participants").insert(
        invited.map((userId) => ({ decision_id: decisionId, user_id: userId })),
      );
      if (inviteError) debugConsole.error("Teilnehmende konnten nicht eingeladen werden:", inviteError);
    }
  };

  /**
   * Trägt den Beschluss in den Entscheidungsblock der Agenda ein.
   * Schlägt das fehl, bleibt der Beschluss bestehen: er hängt über `meeting_id`
   * an der Sitzung und erscheint in deren Entscheidungsliste.
   */
  const linkDecision = async (decisionId: string): Promise<DecisionLinkResult | null> => {
    if (!meeting.id) return null;
    try {
      const { data: block, error: blockError } = await supabase
        .from("meeting_agenda_items")
        .select("id, result_text")
        .eq("meeting_id", meeting.id)
        .eq("system_type", "decisions")
        .is("parent_id", null)
        .order("order_index")
        .limit(1)
        .maybeSingle();
      if (blockError) throw blockError;

      const note = addDecisionToNote(block?.result_text ?? null, decisionId, decisionSummary(title, description));

      if (block) {
        const { error } = await supabase
          .from("meeting_agenda_items")
          .update({ result_text: note })
          .eq("id", block.id);
        if (error) throw error;
        return { blockId: block.id, blockCreated: false, note };
      }

      const { data: created, error } = await supabase
        .from("meeting_agenda_items")
        .insert({
          meeting_id: meeting.id,
          title: "Entscheidungen",
          system_type: "decisions",
          order_index: (item?.order_index ?? 0) + 1,
          duration_minutes: 10,
          is_completed: false,
          is_recurring: false,
          result_text: note,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return { blockId: created?.id ?? null, blockCreated: true, note };
    } catch (error) {
      debugConsole.error("Beschluss konnte nicht in der Agenda verlinkt werden:", error);
      return null;
    }
  };

  /** Nur Ansichten mit Beschlüssen aktualisieren, nicht den gesamten Cache. */
  const refreshDecisionViews = () => {
    void queryClient.invalidateQueries({ queryKey: ["jour-fixe-open-decisions"] });
    void queryClient.invalidateQueries({ queryKey: ["my-work-decisions"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-deadlines"] });
  };

  const save = async () => {
    if (!user?.id || !meeting.id) return;
    if (!title.trim()) {
      notify.error("Titel fehlt", { description: "Ein Beschluss braucht einen Titel." });
      return;
    }
    if (!meeting.tenant_id) {
      notify.error("Büro fehlt", { description: "Der Beschluss kann ohne Mandant nicht gespeichert werden." });
      return;
    }

    setSaving(true);
    setLinkError(null);
    const decisionId = createdRef.current ?? creationId.current;
    try {
      if (!createdRef.current) {
        await createDecision(decisionId);
        createdRef.current = decisionId;
      }

      const link = await linkDecision(decisionId);
      refreshDecisionViews();
      // Der Beschluss hängt an der Sitzung – die Entscheidungsliste soll ihn
      // auch dann zeigen, wenn der Agenda-Block nicht geschrieben werden konnte.
      onSaved?.();

      if (!link) {
        setLinkError(
          "Der Beschluss ist gespeichert, konnte aber nicht in den Entscheidungsblock der Agenda eingetragen werden. Er steht in der Entscheidungsliste der Sitzung und unter „Meine Arbeit → Entscheidungen“.",
        );
        // Kein zusätzlicher Fehler-Toast: der Hinweis steht bereits im offenen Dialog.
        return;
      }

      onLinked?.(link);
      notify.success("Beschluss erfasst", {
        description: invited.length > 0
          ? `Im System hinterlegt und an ${invited.length} Teilnehmende verteilt.`
          : "Im System hinterlegt und mit der Agenda verlinkt.",
      });
      onOpenChange(false);
    } catch (error) {
      debugConsole.error("Beschluss konnte nicht erfasst werden:", error);
      notify.error("Fehler", { description: "Der Beschluss konnte nicht gespeichert werden." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="size-4" />
            Beschluss erfassen
          </DialogTitle>
          <DialogDescription>
            Wird als Entscheidung angelegt, im Entscheidungsblock der Agenda verlinkt und den Eingeladenen im System angezeigt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="decision-title">Beschluss</Label>
            <Input
              id="decision-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Was ist beschlossen?"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="decision-description">Begründung / Auftrag</Label>
            <Textarea
              id="decision-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Kurzbegründung, Zuständigkeit oder nächster Schritt"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="decision-deadline">Antwortfrist (optional)</Label>
            <Input
              id="decision-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </div>
          {invitees.length > 0 && (
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">Beteiligte</legend>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {invitees
                  .filter((invitee) => invitee.userId !== user?.id)
                  .map((invitee) => (
                    <label key={invitee.userId} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={invited.includes(invitee.userId)}
                        onCheckedChange={(checked) =>
                          setInvited((current) =>
                            checked === true
                              ? [...new Set([...current, invitee.userId])]
                              : current.filter((id) => id !== invitee.userId),
                          )
                        }
                      />
                      {invitee.name}
                    </label>
                  ))}
              </div>
            </fieldset>
          )}
          {linkError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
            >
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span>{linkError}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                „Erneut verlinken“ trägt den bereits gespeicherten Beschluss nach – es entsteht kein zweiter Beschluss.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {linkError ? "Schließen" : "Abbrechen"}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {linkError ? "Erneut verlinken" : "Beschluss speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
