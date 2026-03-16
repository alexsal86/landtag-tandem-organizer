import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarPlus, Keyboard, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { toast } from "sonner";

const APPOINTMENT_REQUEST_TITLE_MARKER = "appointment_request_title:";
const APPOINTMENT_REQUEST_START_MARKER = "appointment_request_start:";
const APPOINTMENT_REQUEST_LOCATION_MARKER = "appointment_request_location:";
const APPOINTMENT_REQUEST_REQUESTER_MARKER = "appointment_request_requester:";
const APPOINTMENT_REQUEST_TARGET_DEPUTY_MARKER = "appointment_request_target_deputy:";

interface GlobalAppointmentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalAppointmentRequestDialog({ open, onOpenChange }: GlobalAppointmentRequestDialogProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [requestTitle, setRequestTitle] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [requestTime, setRequestTime] = useState("");
  const [requestLocation, setRequestLocation] = useState("");
  const [requestRequester, setRequestRequester] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRequestTitle("");
    setRequestDate("");
    setRequestTime("");
    setRequestLocation("");
    setRequestRequester("");
  }, [open]);

  const handleCreateRequest = async () => {
    if (!user?.id || !currentTenant?.id) return;
    if (!requestTitle.trim() || !requestDate) {
      toast.error("Bitte Titel und Datum angeben");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const requestedStart = requestTime ? `${requestDate}T${requestTime}:00` : `${requestDate}T09:00:00`;
      const requestedStartIso = new Date(requestedStart).toISOString();

      const { data: empSettings, error: settingsError } = await supabase
        .from("employee_settings")
        .select("admin_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      const adminId = empSettings?.admin_id;

      if (!adminId) {
        toast.error("Kein Abgeordneter zugeordnet. Bitte in den Mitarbeiter-Einstellungen zuordnen lassen.");
        return;
      }

      if (adminId === user.id) {
        toast.error("Als Abgeordneter können Sie keine Terminanfrage an sich selbst senden.");
        return;
      }

      const { data: decision, error: decisionError } = await supabase
        .from("task_decisions")
        .insert([
          {
            title: `Terminanfrage: ${requestTitle.trim()}`,
            description: [
              "Bitte reagieren: Zusage, Absage oder Rückfrage.",
              `${APPOINTMENT_REQUEST_TITLE_MARKER}${requestTitle.trim()}`,
              `${APPOINTMENT_REQUEST_START_MARKER}${requestedStartIso}`,
              `${APPOINTMENT_REQUEST_TARGET_DEPUTY_MARKER}${adminId}`,
              requestRequester.trim() ? `${APPOINTMENT_REQUEST_REQUESTER_MARKER}${requestRequester.trim()}` : null,
              requestLocation.trim() ? `${APPOINTMENT_REQUEST_LOCATION_MARKER}${requestLocation.trim()}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
            created_by: user.id,
            tenant_id: currentTenant.id,
            response_deadline: requestedStartIso,
            status: "open",
            visible_to_all: true,
            response_options: [
              { key: "yes", label: "Zusage", color: "green", icon: "check", order: 1 },
              { key: "no", label: "Absage", color: "red", icon: "x", order: 2 },
              { key: "question", label: "Rückfrage", color: "orange", icon: "message-circle", order: 3 },
            ],
          },
        ])
        .select("id")
        .single();

      if (decisionError) throw decisionError;

      const { error: participantError } = await supabase
        .from("task_decision_participants")
        .insert([
          {
            decision_id: decision.id,
            user_id: adminId,
          },
        ]);

      if (participantError) throw participantError;

      toast.success("Terminanfrage erstellt");
      onOpenChange(false);
    } catch (error: unknown) {
      debugConsole.error("Error creating global appointment request:", error);
      toast.error(error instanceof Error ? error.message : "Terminanfrage konnte nicht erstellt werden");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Schnelle Terminanfrage
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="global-request-title">Titel</Label>
            <Input id="global-request-title" value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder="z. B. Gespräch mit Verband" />
          </div>
          <div>
            <Label htmlFor="global-request-date">Datum</Label>
            <Input id="global-request-date" type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="global-request-time">Uhrzeit</Label>
            <Input id="global-request-time" type="time" value={requestTime} onChange={(event) => setRequestTime(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="global-request-location">Ort / Format</Label>
            <Input id="global-request-location" value={requestLocation} onChange={(event) => setRequestLocation(event.target.value)} placeholder="Landtag / Digital" />
          </div>
          <div>
            <Label htmlFor="global-request-requester">Anfragende Stelle</Label>
            <Input id="global-request-requester" value={requestRequester} onChange={(event) => setRequestRequester(event.target.value)} placeholder="Name / Organisation" />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mr-auto">
            <Keyboard className="h-3 w-3" />
            <span>Cmd/Ctrl + Shift + .</span>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmittingRequest}>
            Abbrechen
          </Button>
          <Button onClick={handleCreateRequest} disabled={isSubmittingRequest}>
            {isSubmittingRequest ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Erstelle...
              </>
            ) : (
              "Terminanfrage anlegen"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
