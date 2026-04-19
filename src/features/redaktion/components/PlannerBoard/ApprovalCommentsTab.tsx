import { useState } from "react";
import { AlertTriangle, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useApprovalComments } from "@/features/redaktion/hooks/useApprovalComments";

interface ApprovalCommentsTabProps {
  contentItemId: string | null;
  responsibleUserId: string | null;
  topicTitle: string;
  onChangeRequested?: () => void;
}

export function ApprovalCommentsTab({ contentItemId, responsibleUserId, topicTitle, onChangeRequested }: ApprovalCommentsTabProps) {
  const { toast } = useToast();
  const { comments, loading, addComment } = useApprovalComments(contentItemId);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSend = async (changeRequest: boolean) => {
    if (!draft.trim()) {
      toast({ title: "Kommentar ist leer", variant: "destructive" });
      return;
    }
    if (!contentItemId) return;
    try {
      setSubmitting(true);
      await addComment(draft, changeRequest, responsibleUserId, topicTitle);
      setDraft("");
      if (changeRequest) {
        toast({ title: "Änderungswunsch gesendet", description: "Verantwortliche Person wurde benachrichtigt." });
        onChangeRequested?.();
      } else {
        toast({ title: "Kommentar hinzugefügt" });
      }
    } catch (err) {
      toast({ title: "Konnte nicht gespeichert werden", description: String(err instanceof Error ? err.message : err), variant: "destructive" });
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
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void handleSend(false)} disabled={submitting || !contentItemId}>
            <Send className="h-3.5 w-3.5 mr-1" /> Kommentar senden
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void handleSend(true)} disabled={submitting || !contentItemId || !responsibleUserId}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Änderung gewünscht
          </Button>
          {!responsibleUserId && (
            <span className="text-xs text-muted-foreground self-center">Verantwortliche Person setzen, um Änderungswunsch zu senden.</span>
          )}
        </div>
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
