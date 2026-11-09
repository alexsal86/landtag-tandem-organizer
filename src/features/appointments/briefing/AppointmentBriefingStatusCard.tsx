import { useBriefingEditorView } from "./useBriefingEditorView";
import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { notify } from "@/lib/notify";
import { asBriefingStatus, BRIEFING_STATUS_LABELS, canAdvanceBriefing, type BriefingAction } from "../briefing";
import { briefingErrorMessage, useAppointmentBriefing, useBriefingMutations } from "./useBriefing";
import { BriefingRequestPopover } from "./BriefingRequestPopover";
import { CompactBriefingEditor } from "./CompactBriefingEditor";
import { briefingDepthLabel, canGoLive } from "./briefingModel";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const VARIANT: Record<string, "secondary" | "outline" | "default"> = { undecided: "outline", none: "secondary", assigned: "default", in_review: "default", approved: "secondary", completed: "secondary" };

/** Briefing tile in the appointment sidebar. Server enforces roles; UI hides decider buttons optimistically. */
export function AppointmentBriefingStatusCard({ appointmentId, title, startTime, isDecider }: { appointmentId: string; title: string; startTime: string; isDecider: boolean }) {
  const { user } = useAuth();
  const { users } = useTenantUsers();
  const { data, isPending, error, refetch } = useAppointmentBriefing(appointmentId);
  const { setBriefing, advance } = useBriefingMutations();
  const [editorOpen, setEditorOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const { getView } = useBriefingEditorView();
  const [returnNote, setReturnNote] = useState("");
  const navigate = useNavigate();
  if (isPending) return <div className="rounded-lg border p-3 text-sm" role="status">Briefing-Status wird geladen…</div>;
  if (!data) return <div className="space-y-2 rounded-lg border p-3"><p className="text-sm" role="alert">Briefing-Status konnte nicht geladen werden.</p><p className="text-xs text-muted-foreground">{briefingErrorMessage(error, "Bitte erneut laden.")}</p><Button size="sm" variant="outline" onClick={() => void refetch()}>Erneut laden</Button></div>;
  const goLive = async () => {
    const { data: prep } = await supabase.from("appointment_preparations").select("id").eq("appointment_id", appointmentId).eq("is_archived", false).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!prep) { notify.error("Für diesen Termin gibt es noch kein Briefing."); return; }
    navigate(`/briefing-live?preparationId=${prep.id}&appointmentId=${appointmentId}`);
  };
  const status = asBriefingStatus(data.briefing_status);
  const assigneeName = data.briefing_assignee_name || users.find((u) => u.id === data.briefing_assignee_id)?.display_name;
  const isAssignee = data.briefing_assignee_id === user?.id;

  const openBriefing = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const { data: prep, error } = await supabase.from("appointment_preparations").select("id,created_by").eq("appointment_id", appointmentId).eq("is_archived", false).order("created_at").limit(1).maybeSingle();
      if (error) throw error;
      const depth = getView(prep?.id) ?? data.briefing_depth ?? "compact";
      if (depth === "full" && prep) {
        navigate(`/appointment-preparation/${prep.id}?view=${isDecider || isAssignee || prep.created_by === user?.id ? "preparation" : "briefing"}&depth=full`);
      } else {
        setEditorOpen(true);
      }
    } catch (error) {
      notify.error(briefingErrorMessage(error, "Briefing konnte nicht geöffnet werden."));
    } finally {
      setOpening(false);
    }
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); notify.success(ok); } catch (e) { notify.error(briefingErrorMessage(e, "Aktion fehlgeschlagen.")); }
  };
  const act = (action: BriefingAction, ok: string) => run(() => advance.mutateAsync({ appointmentId, action, note: action === "return" ? returnNote.trim() : undefined }), ok);

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-label font-medium"><FileText className="h-4 w-4 text-muted-foreground" />Briefing</span>
        <Badge variant={VARIANT[status]}>{BRIEFING_STATUS_LABELS[status]}</Badge>
      </div>
      {data.briefing_assignee_id && status !== "none" && (
        <p className="text-caption text-muted-foreground">
          Vergeben an: <strong className="text-foreground">{assigneeName ?? `Person (${data.briefing_assignee_id})`}</strong>{data.briefing_due_at && ` · Frist ${format(new Date(data.briefing_due_at), "EEE d.M. HH:mm", { locale: de })}`}
        </p>
      )}
      {status !== "none" && status !== "undecided" && <p className="text-caption text-muted-foreground">Beauftragtes Briefing: <strong className="text-foreground">{briefingDepthLabel(data.briefing_depth)}</strong></p>}
      {error && <p className="text-caption text-destructive" role="alert">Der Status konnte nicht aktualisiert werden. <button type="button" className="underline" onClick={() => void refetch()}>Erneut laden</button></p>}
      {!data.briefing_assignee_id && <p className="text-caption text-muted-foreground">{status === "none" ? "Für diesen Termin ist kein Briefing beauftragt." : "Das Briefing ist noch nicht vergeben."}</p>}
      <p className="text-caption text-muted-foreground">Vorbereitung für das gesamte Team sichtbar.</p>
      {data.briefing_instructions && status !== "none" && <p className="text-caption">{data.briefing_instructions}</p>}
      <div className="flex flex-wrap gap-2">
        {status === "undecided" && isDecider && (
          <>
            <Button size="sm" variant="outline" onClick={() => run(() => setBriefing.mutateAsync({ appointmentId, decision: "none" }), "Kein Briefing nötig.")}>Kein Briefing nötig</Button>
            <BriefingRequestPopover appointmentId={appointmentId} startTime={startTime} trigger={<Button size="sm">Briefing anfordern</Button>} />
          </>
        )}
        {status === "none" && isDecider && (
          <BriefingRequestPopover appointmentId={appointmentId} startTime={startTime} trigger={<Button size="sm" variant="ghost">Doch Briefing anfordern</Button>} />
        )}
        {status !== "undecided" && status !== "none" && <Button size="sm" variant="outline" disabled={opening} onClick={() => void openBriefing()}>Briefing öffnen</Button>}
        {canGoLive({ briefing_status: status, start_time: startTime }) && <Button size="sm" onClick={goLive}>Live starten</Button>}
        {canAdvanceBriefing(status, "submit", { isDecider, isAssignee }) && <Button size="sm" onClick={() => act("submit", "Zur Freigabe vorgelegt.")}>Zur Freigabe vorlegen</Button>}
        {canAdvanceBriefing(status, "approve", { isDecider, isAssignee }) && <Button size="sm" onClick={() => act("approve", "Briefing freigegeben.")}>Freigeben</Button>}
        {canAdvanceBriefing(status, "return", { isDecider, isAssignee }) && <div className="w-full space-y-2"><Textarea aria-label="Begründung der Rückgabe" placeholder="Was soll überarbeitet werden?" value={returnNote} onChange={e => setReturnNote(e.target.value)} /><Button disabled={!returnNote.trim() || advance.isPending} size="sm" variant="outline" onClick={() => act("return", "Zurück an Zuarbeit.")}>Zurück mit Anmerkung</Button></div>}
        {status !== "undecided" && status !== "none" && isDecider && <BriefingRequestPopover appointmentId={appointmentId} startTime={startTime} initialAssignee={data.briefing_assignee_id} initialInstructions={data.briefing_instructions} initialDue={data.briefing_due_at} initialDepth={data.briefing_depth === "full" ? "full" : "compact"} trigger={<Button size="sm" variant="outline">Briefing neu vergeben</Button>} />}
        {status === "assigned" && isDecider && (
          <Button size="sm" variant="ghost" onClick={() => run(() => setBriefing.mutateAsync({ appointmentId, decision: "none" }), "Briefing abbestellt.")}>Doch kein Briefing</Button>
        )}
      </div>
      <CompactBriefingEditor open={editorOpen} onOpenChange={setEditorOpen} appointmentId={appointmentId} title={title} />
    </div>
  );
}
