import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { format, addMonths } from "date-fns";
import { de } from "date-fns/locale";

interface EmployeeMeetingSchedulerProps {
  employeeId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: () => void;
}

export function EmployeeMeetingScheduler({
  employeeId,
  employeeName,
  open,
  onOpenChange,
  onScheduled,
}: EmployeeMeetingSchedulerProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingType, setMeetingType] = useState<string>("regular");
  const [intervalMonths, setIntervalMonths] = useState(3);

  // Load employee settings to get their meeting interval
  useEffect(() => {
    if (!employeeId || !open) return;
    const loadSettings = async () => {
      const { data } = await supabase
        .from("employee_settings")
        .select("meeting_interval_months")
        .eq("user_id", employeeId)
        .maybeSingle();
      
      if (data?.meeting_interval_months) {
        setIntervalMonths(data.meeting_interval_months);
      }
    };
    loadSettings();
  }, [employeeId, open]);

  const handleSchedule = async () => {
    if (!user || !currentTenant || !meetingDate) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie ein Datum aus",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Calculate next meeting due date based on interval
      const nextMeetingDue = addMonths(meetingDate, intervalMonths);

      // Create the meeting
      const { data: meeting, error: meetingError } = await supabase
        .from("employee_meetings")
        .insert({
          employee_id: employeeId,
          conducted_by: user.id,
          tenant_id: currentTenant.id,
          meeting_date: meetingDate.toISOString(),
          next_meeting_due: nextMeetingDue.toISOString(),
          meeting_type: meetingType,
          status: "scheduled",
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Update employee settings with last meeting date
      const { error: updateError } = await supabase
        .from("employee_settings")
        .update({
          last_meeting_date: meetingDate.toISOString(),
        })
        .eq("user_id", employeeId);

      if (updateError) console.error("Error updating employee settings:", updateError);

      // Create notification for employee
      await supabase.rpc("create_notification", {
        user_id_param: employeeId,
        type_name: "employee_meeting_scheduled",
        title_param: "Mitarbeitergespräch terminiert",
        message_param: `Ein Mitarbeitergespräch wurde für den ${format(meetingDate, "dd.MM.yyyy", { locale: de })} geplant.`,
        data_param: {
          meeting_id: meeting.id,
          meeting_date: meetingDate.toISOString(),
          meeting_type: meetingType,
        },
        priority_param: "medium",
      });

      toast({
        title: "Gespräch geplant",
        description: `Mitarbeitergespräch mit ${employeeName} für ${format(meetingDate, "dd.MM.yyyy", { locale: de })} geplant.`,
      });

      onScheduled?.();
      onOpenChange(false);
      setMeetingDate(undefined);
      setMeetingType("regular");
    } catch (error: any) {
      console.error("Error scheduling meeting:", error);
      toast({
        title: "Fehler",
        description: error.message || "Gespräch konnte nicht geplant werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Mitarbeitergespräch planen mit {employeeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Gesprächstyp</Label>
            <Select value={meetingType} onValueChange={setMeetingType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Reguläres Mitarbeitergespräch</SelectItem>
                <SelectItem value="probation">Probezeit-Gespräch</SelectItem>
                <SelectItem value="development">Entwicklungsgespräch</SelectItem>
                <SelectItem value="performance">Leistungsbeurteilung</SelectItem>
                <SelectItem value="conflict">Konflikt-/Klärungsgespräch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Datum des Gesprächs</Label>
            <Calendar
              mode="single"
              selected={meetingDate}
              onSelect={setMeetingDate}
              locale={de}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
            {meetingDate && (
              <p className="text-sm text-muted-foreground">
                Nächstes Gespräch voraussichtlich fällig: {format(addMonths(meetingDate, intervalMonths), "dd.MM.yyyy", { locale: de })}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-semibold text-sm">Gesprächsleitfaden</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Befinden & Work-Life-Balance</li>
              <li>• Rückblick & Erfolge</li>
              <li>• Aktuelle Projekte & Aufgaben</li>
              <li>• Entwicklung & Karriereziele</li>
              <li>• Team & Zusammenarbeit</li>
              <li>• Zielvereinbarungen</li>
              <li>• Beidseitiges Feedback</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Nach Erstellung des Termins können Sie das strukturierte Protokoll nutzen.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSchedule} disabled={loading || !meetingDate}>
            {loading ? "Wird geplant..." : "Gespräch planen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
