import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AlertTriangle, CalendarCheck, CalendarX, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  RECOMMENDATION_LABELS,
  canDecide,
  isUrgent,
  requestEnd,
  requestStart,
  type AppointmentRequest,
  type RequestRecommendation,
} from "./logic";
import { useAppointmentRequestMutations, useNextJourFixeDate, useOpenAppointmentRequests } from "./useAppointmentRequests";

interface Props {
  requestId: string | null;
  onOpenChange: (open: boolean) => void;
}

function useConflicts(r: AppointmentRequest | undefined) {
  return useQuery({
    queryKey: ["appointment-requests", "conflicts", r?.id, r?.requested_date, r?.requested_time, r?.duration_minutes],
    enabled: !!r,
    queryFn: async () => {
      const start = requestStart(r!).toISOString();
      const end = requestEnd(r!).toISOString();
      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, start_time")
        .eq("tenant_id", r!.tenant_id)
        .lt("start_time", end)
        .gt("end_time", start)
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function AppointmentRequestDetailDialog({ requestId, onOpenChange }: Props) {
  const { data: requests = [] } = useOpenAppointmentRequests();
  const { data: nextJf = null } = useNextJourFixeDate();
  const request = requests.find((r) => r.id === requestId);
  const { data: conflicts = [] } = useConflicts(request);
  const { role } = useResolvedUserRole();
  const { user } = useAuth();
  const { recommend, decide, remove } = useAppointmentRequestMutations();
  const [note, setNote] = useState("");

  useEffect(() => setNote(request?.recommendation_note ?? ""), [request?.id, request?.recommendation_note]);

  const open = !!requestId;
  const mayDecide = canDecide(role);

  const setRecommendation = async (rec: RequestRecommendation | null) => {
    if (!request) return;
    try {
      await recommend.mutateAsync({ id: request.id, recommendation: rec, note });
      notify.success(rec ? "Empfehlung gespeichert" : "Empfehlung entfernt");
    } catch (e) {
      notify.error("Empfehlung konnte nicht gespeichert werden", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const doDecide = async (decision: "accepted" | "declined") => {
    if (!request) return;
    try {
      await decide.mutateAsync({ id: request.id, decision });
      notify.success(decision === "accepted" ? "Zugesagt – Termin steht im Kalender" : "Abgesagt – Platzhalter entfernt");
      onOpenChange(false);
    } catch (e) {
      notify.error("Entscheidung fehlgeschlagen", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const doDelete = async () => {
    if (!request) return;
    try {
      await remove.mutateAsync(request.id);
      notify.success("Anfrage gelöscht");
      onOpenChange(false);
    } catch (e) {
      notify.error("Löschen fehlgeschlagen", { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {!request ? (
          <DialogHeader>
            <DialogTitle>Anfrage</DialogTitle>
            <DialogDescription>Diese Anfrage ist bereits entschieden oder nicht mehr vorhanden.</DialogDescription>
          </DialogHeader>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {request.title}
                {isUrgent(request, nextJf) && <Badge variant="destructive">Eilig</Badge>}
              </DialogTitle>
              <DialogDescription>
                {format(requestStart(request), request.requested_time ? "EEEE, d. MMMM yyyy, HH:mm 'Uhr'" : "EEEE, d. MMMM yyyy", { locale: de })}
                {request.location ? ` · ${request.location}` : ""}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {request.requester && (<><dt className="text-muted-foreground">Anfrage von</dt><dd>{request.requester}</dd></>)}
              <dt className="text-muted-foreground">Eingang</dt><dd>{CHANNEL_LABELS[request.channel]}</dd>
              {request.response_deadline && (
                <><dt className="text-muted-foreground">Rückmeldung bis</dt><dd>{format(new Date(request.response_deadline + "T00:00:00"), "d. MMMM yyyy", { locale: de })}</dd></>
              )}
              {request.notes && (<><dt className="text-muted-foreground">Notiz</dt><dd className="whitespace-pre-wrap">{request.notes}</dd></>)}
            </dl>

            {conflicts.length > 0 && (
              <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  Überschneidung mit: {conflicts.map((c) => `${c.title} (${format(new Date(c.start_time), "HH:mm")})`).join(", ")}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Empfehlung des Teams</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(RECOMMENDATION_LABELS) as RequestRecommendation[]).map((k) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant={request.recommendation === k ? "default" : "outline"}
                    disabled={recommend.isPending}
                    onClick={() => setRecommendation(request.recommendation === k ? null : k)}
                  >
                    {RECOMMENDATION_LABELS[k]}
                  </Button>
                ))}
              </div>
              <Textarea
                rows={2}
                placeholder="Begründung, z. B. „Kollision mit Ausschuss, Vertretung durch Zweitkandidatin möglich“"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note !== (request.recommendation_note ?? "") && setRecommendation(request.recommendation)}
              />
            </div>

            <DialogFooter className="gap-2">
              {(request.created_by === user?.id || mayDecide) && (
                <Button type="button" variant="ghost" size="sm" className="mr-auto text-muted-foreground" onClick={doDelete} disabled={remove.isPending}>
                  <Trash2 className="mr-1 h-4 w-4" /> Löschen
                </Button>
              )}
              {mayDecide ? (
                <>
                  <Button type="button" variant="outline" onClick={() => doDecide("declined")} disabled={decide.isPending}>
                    <CalendarX className="mr-1 h-4 w-4" /> Absagen
                  </Button>
                  <Button type="button" onClick={() => doDecide("accepted")} disabled={decide.isPending}>
                    {decide.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-1 h-4 w-4" />}
                    Zusagen
                  </Button>
                </>
              ) : (
                <p className={cn("text-xs text-muted-foreground")}>Zusagen oder absagen können Abgeordnete und Büroleitung.</p>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
