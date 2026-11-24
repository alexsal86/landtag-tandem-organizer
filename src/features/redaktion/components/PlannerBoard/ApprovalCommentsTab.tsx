import { useState } from "react";
import { AlertTriangle, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApprovalComments } from "@/features/redaktion/hooks/useApprovalComments";
import { CHANGE_REQUEST_DUE_OPTIONS, changeRequestDueDate } from "@/features/redaktion/approval";
import { notify } from "@/lib/notify";

interface ApprovalCommentsTabProps {
  contentItemId: string | null;
  topicTitle: string;
  onChangeRequested?: () => void;
}

export function ApprovalCommentsTab({ contentItemId, topicTitle, onChangeRequested }: ApprovalCommentsTabProps) {
  const { comments, loading, addComment, requestChanges } = useApprovalComments(contentItemId);
  const [draft, setDraft] = useState("");
  const [dueDays, setDueDays] = useState<number>(3);
  const [submitting, setSubmitting] = useState(false);

  const handleComment = async () => {
    if (!draft.trim()) {
      notify.error("Kommentar ist leer");
      return;
    }
    if (!contentItemId) return;
    try {
      setSubmitting(true);
      await addComment(draft, false, null, topicTitle);
      setDraft("");
      notify.success("Kommentar hinzugefügt");
    } catch (err) {
      notify.error("Konnte nicht gespeichert werden", { description: String(err instanceof Error ? err.message : err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeRequest = async () => {
    if (!draft.trim()) {
      notify.error("Bitte den Änderungswunsch begründen");
      return;
    }
    if (!contentItemId) return;
    try {
      setSubmitting(true);
      await requestChanges(draft, dueDays);
      setDraft("");
      const due = changeRequestDueDate(dueDays);
      notify.success("Änderungswunsch gesendet", {
        description: `Beitrag ist zurück in Arbeit – Aufgabe mit Frist ${format(due, "dd.MM.yyyy")} liegt bei der verantwortlichen Person.`,
      });
      onChangeRequested?.();
    } catch (err) {
      notify.error("Änderungswunsch nicht gespeichert", { description: String(err instanceof Error ? err.message : err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-md border p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Kommentar zur Freigabe oder Änderungswunsch begründen…"
          rows={3}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void handleComment()} disabled={submitting || !contentItemId}>
            <Send className="h-3.5 w-3.5 mr-1" /> Kommentar senden
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void handleChangeRequest()} disabled={submitting || !contentItemId}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Änderung gewünscht
          </Button>
          <Select value={String(dueDays)} onValueChange={(value) => setDueDays(Number(value))}>
            <SelectTrigger className="h-8 w-[150px]" aria-label="Frist für den Änderungswunsch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANGE_REQUEST_DUE_OPTIONS.map((days) => (
                <SelectItem key={days} value={String(days)}>Frist {days} Tage</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          „Änderung gewünscht" setzt den Beitrag auf „In Arbeit" und legt den Ball mit Aufgabe und Frist bei der verantwortlichen Person ab.
        </p>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Lade Kommentare…</p>}

      {!loading && comments.length === 0 && (
        <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" /> Noch keine Freigabe-Kommentare.
        </div>
      )}

      <div className="space-y-2">
        {comments.map((c) => (
          <div key={c.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{c.author_name || "Unbekannt"}</span>
                {c.is_change_request && (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Änderung gewünscht
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(c.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
