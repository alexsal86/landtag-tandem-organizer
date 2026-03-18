import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { format, addMinutes, addMonths, startOfDay, type Locale } from "date-fns";
import { de } from "date-fns/locale";
import { debugConsole } from "@/utils/debugConsole";

const DEFAULT_TENANT_TIME_ZONE = "Europe/Berlin";

const getTimeZoneOffsetMilliseconds = (date: Date, timeZone: string) => {
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return tzDate.getTime() - date.getTime();
};

const zonedTimeToUtc = (dateTimeLocal: string, timeZone: string) => {
  const localDate = new Date(dateTimeLocal);
  const offset = getTimeZoneOffsetMilliseconds(localDate, timeZone);
  return new Date(localDate.getTime() - offset);
};

const formatInTimeZone = (
  date: Date,
  timeZone: string,
  formatPattern: "dd.MM.yyyy" | "HH:mm",
  options?: { locale?: Locale },
) => {
  const zonedDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return format(zonedDate, formatPattern, options);
};

interface EmployeeMeetingSchedulerProps {
  employeeId: string;
  employeeName: string;
  requestId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: (meetingId?: string) => void | Promise<void>;
}

export function EmployeeMeetingScheduler({
  employeeId,
  employeeName,
  requestId,
  open,
  onOpenChange,
  onScheduled,
}: EmployeeMeetingSchedulerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingType, setMeetingType] = useState<string>("regular");
  const [intervalMonths, setIntervalMonths] = useState(3);
  const [addToCalendar, setAddToCalendar] = useState<boolean>(true);
  const [meetingStartTime, setMeetingStartTime] = useState<string>("10:00");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const tenantTimeZone =
    (typeof currentTenant?.settings === "object" &&
      currentTenant.settings !== null &&
      ((currentTenant.settings as any)?.timezone ?? (currentTenant.settings as any)?.time_zone)) ||
    DEFAULT_TENANT_TIME_ZONE;

  const toUtcFromTenantLocal = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const localDateTime = `${format(date, "yyyy-MM-dd")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
    return zonedTimeToUtc(localDateTime, tenantTimeZone);
  };

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
      // Canonical scheduling model: local tenant time -> normalized absolute UTC timestamps
      const meetingStartUtc = toUtcFromTenantLocal(meetingDate, meetingStartTime);
      const meetingEndUtc = addMinutes(meetingStartUtc, durationMinutes);
      const meetingDateUtc = toUtcFromTenantLocal(meetingDate, "00:00");
      const nextMeetingDueUtc = toUtcFromTenantLocal(addMonths(meetingDate, intervalMonths), "00:00");

      const meetingDateLabel = formatInTimeZone(meetingStartUtc, tenantTimeZone, "dd.MM.yyyy", {
        locale: de,
      });
      const meetingTimeLabel = formatInTimeZone(meetingStartUtc, tenantTimeZone, "HH:mm", {
        locale: de,
      });

      // Create the meeting
      const { data: meeting, error: meetingError } = await supabase
        .from("employee_meetings")
        .insert([{
          employee_id: employeeId,
          conducted_by: user.id,
          tenant_id: currentTenant.id,
          meeting_date: meetingDateUtc.toISOString(),
          next_meeting_due: nextMeetingDueUtc.toISOString(),
          meeting_type: meetingType,
          status: "scheduled",
        }])
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Update employee settings with last meeting date
      const { error: updateError } = await supabase
        .from("employee_settings")
        .update({
          last_meeting_date: meetingDateUtc.toISOString(),
        })
        .eq("user_id", employeeId);

      if (updateError) debugConsole.error("Error updating employee settings:", updateError);

      // Create notification for employee
      await supabase.rpc("create_notification", {
        user_id_param: employeeId,
        type_name: "employee_meeting_scheduled",
        title_param: "Mitarbeitergespräch terminiert",
        message_param: `Ein Mitarbeitergespräch wurde für den ${meetingDateLabel} um ${meetingTimeLabel} Uhr (${tenantTimeZone}) geplant.`,
        data_param: {
          meeting_id: meeting.id,
          meeting_date: meetingStartUtc.toISOString(),
          display_date: meetingDateLabel,
          display_time: meetingTimeLabel,
          timezone: tenantTimeZone,
          meeting_type: meetingType,
        },
        priority_param: "medium",
      });

      const { error: requestUpdateError } = await supabase.rpc("reconcile_employee_meeting_requests", {
        p_tenant_id: currentTenant.id,
        p_meeting_id: meeting.id,
        p_employee_id: employeeId,
        p_explicit_request_id: requestId ?? undefined,
        p_source: requestId ? "scheduler_explicit" : "scheduler_auto",
        p_time_window_days: 45,
      });

      if (requestUpdateError) {
        debugConsole.error("Error reconciling meeting requests:", requestUpdateError);
      }

      // Create calendar entry if checkbox is active
      if (addToCalendar) {
        const { error: calendarError } = await supabase
          .from("appointments")
          .insert([{
            user_id: user.id,
            tenant_id: currentTenant.id,
            title: `Mitarbeitergespräch mit ${employeeName}`,
            description: JSON.stringify({ 
              employee_meeting_id: meeting.id, 
              meeting_type: meetingType,
              timezone: tenantTimeZone,
            }),
            category: "employee_meeting",
            start_time: meetingStartUtc.toISOString(),
            end_time: meetingEndUtc.toISOString(),
            status: "planned",
            priority: "high",
          }]);

        if (calendarError) {
          debugConsole.error("Calendar entry error:", calendarError);
          toast({
            title: "Hinweis",
            description: "Gespräch erstellt, aber Kalendereintrag konnte nicht angelegt werden",
            variant: "default",
          });
        }
      }

      toast({
        title: "Gespräch geplant",
        description: `Mitarbeitergespräch mit ${employeeName} für ${meetingDateLabel} um ${meetingTimeLabel} Uhr (${tenantTimeZone}) geplant${addToCalendar ? ' und im Kalender eingetragen' : ''}.`,
      });

      await onScheduled?.(meeting.id);
      onOpenChange(false);
      setMeetingDate(undefined);
      setMeetingType("regular");
      setMeetingStartTime("10:00");
      setDurationMinutes(60);
      setCurrentMonth(new Date());

      // Navigate to meeting protocol
      navigate(`/employee-meeting/${meeting.id}`);
    } catch (error: unknown) {
      debugConsole.error("Error scheduling meeting:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Gespräch konnte nicht geplant werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mitarbeitergespräch planen mit {employeeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Gesprächstyp</Label>
            <select
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value as typeof meetingType)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="regular">Reguläres Mitarbeitergespräch</option>
              <option value="probation">Probezeit-Gespräch</option>
              <option value="development">Entwicklungsgespräch</option>
              <option value="performance">Leistungsbeurteilung</option>
              <option value="conflict">Konflikt-/Klärungsgespräch</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Datum des Gesprächs</Label>
            <Calendar
              mode="single"
              selected={meetingDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              onSelect={(date) => {
                setMeetingDate(date);
                if (date) setCurrentMonth(date);
              }}
              locale={de}
              captionLayout="dropdown"
              fromYear={new Date().getFullYear() - 1}
              toYear={new Date().getFullYear() + 2}
              disabled={(date) => date < startOfDay(new Date())}
              className="rounded-md border"
            />
            {meetingDate && (
              <p className="text-sm text-muted-foreground">
                Nächstes Gespräch voraussichtlich fällig: {format(addMonths(meetingDate, intervalMonths), "dd.MM.yyyy", { locale: de })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="meetingStartTime">Startzeit</Label>
              <input
                id="meetingStartTime"
                type="time"
                value={meetingStartTime}
                onChange={(e) => setMeetingStartTime(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meetingDuration">Dauer</Label>
              <select
                id="meetingDuration"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={30}>30 Minuten</option>
                <option value={45}>45 Minuten</option>
                <option value={60}>60 Minuten</option>
                <option value={90}>90 Minuten</option>
              </select>
            </div>
          </div>

          {/* Calendar Checkbox */}
          <div className="flex items-center space-x-2 p-3 border rounded-lg">
            <input
              type="checkbox"
              id="addToCalendar"
              checked={addToCalendar}
              onChange={(e) => setAddToCalendar(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="addToCalendar" className="text-sm cursor-pointer font-normal">
              Als Kalendereintrag hinzufügen ({meetingStartTime} Uhr, {durationMinutes} Min.)
            </Label>
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
