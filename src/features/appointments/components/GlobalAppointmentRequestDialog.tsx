import { useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarPlus, Keyboard, Loader2 } from "lucide-react";
import { useAppointmentRequest } from "@/hooks/useAppointmentRequest";
import { toast } from "sonner";

interface GlobalAppointmentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalAppointmentRequestDialog({ open, onOpenChange }: GlobalAppointmentRequestDialogProps) {
  const {
    requestTitle,
    setRequestTitle,
    requestDate,
    setRequestDate,
    requestTime,
    setRequestTime,
    requestLocation,
    setRequestLocation,
    requestRequester,
    setRequestRequester,
    isSubmittingRequest,
    resetForm,
    createRequest,
  } = useAppointmentRequest({
    onSuccess: (message) => {
      toast.success(message);
      onOpenChange(false);
    },
    onError: (message, description) => {
      const fullMessage = description ? `${message}: ${description}` : message;
      toast.error(fullMessage);
    },
  });

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, resetForm]);

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
          <Button onClick={createRequest} disabled={isSubmittingRequest}>
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
