import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Save, Check, Lock, Unlock, Plus, Trash2, Play, CheckCircle2, Circle, Loader2, XCircle, CalendarClock, Ban } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmployeeMeetingPDFExport } from "@/components/EmployeeMeetingPDFExport";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { cn } from "@/lib/utils";

interface EmployeeMeetingProtocolProps {
  meetingId: string;
  onBack?: () => void;
}

interface ProtocolData {
  wellbeing_mood?: string;
  wellbeing_workload?: string;
  wellbeing_balance?: string;
  wellbeing_mood_rating?: number;
  wellbeing_workload_rating?: number;
  wellbeing_balance_rating?: number;
  review_successes?: string;
  review_challenges?: string;
  review_learnings?: string;
  projects_status?: string;
  projects_blockers?: string;
  projects_support?: string;
  development_skills?: string;
  development_training?: string;
  development_career?: string;
  team_dynamics?: string;
  team_communication?: string;
  goals?: string;
  feedback_mutual?: string;
  next_steps?: string;
}

interface ActionItem {
  id?: string;
  description: string;
  owner: string;
  assigned_to?: string;
  due_date?: string;
  status: string;
  notes?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  meeting_id?: string;
  tenant_id?: string;
  task_id?: string;
}

// ─── Rating Scale Component ──────────────────────────────
function RatingScale({ 
  value, 
  onChange, 
  disabled, 
  labels 
}: { 
  value: number | undefined; 
  onChange: (v: number) => void; 
  disabled: boolean; 
  labels: [string, string]; 
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 text-right">{labels[0]}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition-all",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              disabled && "cursor-not-allowed opacity-50",
              !disabled && "cursor-pointer hover:scale-110",
              value && n <= value
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground/30 bg-background"
            )}
          >
            <span className="text-xs font-medium">{n}</span>
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground w-24">{labels[1]}</span>
    </div>
  );
}

// ─── Status Progress Component ──────────────────────────
function StatusProgress({ status }: { status: string }) {
  const isCancelled = status === "cancelled" || status === "cancelled_by_employee" || status === "rescheduled";
  
  if (isCancelled) {
    const label = status === "cancelled" ? "Abgesagt" : status === "cancelled_by_employee" ? "Vom Mitarbeiter abgesagt" : "Umterminiert";
    return (
      <div className="flex items-center gap-2">
        <Ban className="h-5 w-5 text-destructive" />
        <span className="text-sm font-medium text-destructive">{label}</span>
      </div>
    );
  }

  const steps = [
    { key: "scheduled", label: "Geplant" },
    { key: "in_progress", label: "In Durchführung" },
    { key: "completed", label: "Abgeschlossen" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          {i <= currentIndex ? (
            <CheckCircle2 className={cn("h-5 w-5", i < currentIndex ? "text-primary" : "text-primary animate-pulse")} />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground/40" />
          )}
          <span className={cn("text-sm", i <= currentIndex ? "font-medium text-foreground" : "text-muted-foreground")}>
            {step.label}
          </span>
          {i < steps.length - 1 && <div className={cn("w-8 h-0.5 mx-1", i < currentIndex ? "bg-primary" : "bg-muted-foreground/20")} />}
        </div>
      ))}
    </div>
  );
}

// ─── Auto-Save Indicator ────────────────────────────────
function SaveIndicator({ state, lastSaved }: { state: "saved" | "saving" | "unsaved"; lastSaved: Date | null }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className={cn(
      "h-2 w-2 rounded-full",
        state === "saved" && "bg-primary",
        state === "saving" && "bg-accent-foreground/50 animate-pulse",
        state === "unsaved" && "bg-destructive/60"
      )} />
      <span className="text-muted-foreground">
        {state === "saving" && "Speichere..."}
        {state === "unsaved" && "Ungespeichert"}
        {state === "saved" && lastSaved && `Gespeichert ${format(lastSaved, "HH:mm")}`}
        {state === "saved" && !lastSaved && "Gespeichert"}
      </span>
    </div>
  );
}

// ─── Rich Text Field (edit or display) ──────────────────
function ProtocolField({ 
  label, value, onChange, canEdit, placeholder, minHeight = "80px" 
}: { 
  label: string; value: string | undefined; onChange: (v: string) => void; canEdit: boolean; placeholder: string; minHeight?: string;
}) {
  if (!canEdit) {
    return (
      <div>
        <Label>{label}</Label>
        {value ? <RichTextDisplay content={value} /> : <p className="text-sm text-muted-foreground italic">Keine Angabe</p>}
      </div>
    );
  }
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <SimpleRichTextEditor
        initialContent={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={!canEdit}
        minHeight={minHeight}
      />
    </div>
  );
}

export function EmployeeMeetingProtocol({ meetingId, onBack }: EmployeeMeetingProtocolProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meeting, setMeeting] = useState<any>(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);

  // Protocol data
  const [protocolData, setProtocolData] = useState<ProtocolData>({});
  const [employeePrep, setEmployeePrep] = useState<any>({});
  const [supervisorPrep, setSupervisorPrep] = useState<any>({});
  const [privateNotes, setPrivateNotes] = useState("");
  const [sharedDuringMeeting, setSharedDuringMeeting] = useState(false);

  // Action items
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newActionItem, setNewActionItem] = useState<ActionItem>({
    description: "",
    owner: "employee",
    status: "open",
  });

  // Auto-save state
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataChangedRef = useRef(false);

  // Cancel/reschedule dialog state (must be before early returns)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");

  // Load meeting data
  useEffect(() => {
    if (!meetingId || !user) return;
    loadMeetingData();
  }, [meetingId, user]);

  const loadMeetingData = async () => {
    try {
      setLoading(true);
      // Fetch meeting without profile joins (FK points to auth.users, not profiles)
      const { data: meetingData, error: meetingError } = await supabase
        .from("employee_meetings")
        .select("*")
        .eq("id", meetingId)
        .maybeSingle();

      if (meetingError) throw meetingError;
      if (!meetingData) {
        setMeeting(null);
        return;
      }

      // Fetch profile names separately
      const userIds = [meetingData.employee_id, meetingData.conducted_by].filter(Boolean);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      const enrichedMeeting = {
        ...meetingData,
        employee_name: profileMap.get(meetingData.employee_id) || "Mitarbeiter",
        supervisor_name: profileMap.get(meetingData.conducted_by) || "Vorgesetzter",
      };

      setMeeting(enrichedMeeting);
      setIsEmployee(meetingData.employee_id === user!.id);
      setIsSupervisor(meetingData.conducted_by === user!.id);

      if (meetingData.protocol_data) {
        setProtocolData(meetingData.protocol_data as ProtocolData);
      }
      if (meetingData.employee_preparation) {
        const empPrep = meetingData.employee_preparation as any;
        setEmployeePrep(empPrep);
        if (user!.id === meetingData.employee_id && empPrep?.private_notes) {
          setPrivateNotes(empPrep.private_notes);
        }
      }
      if (meetingData.supervisor_preparation) {
        const supPrep = meetingData.supervisor_preparation as any;
        setSupervisorPrep(supPrep);
        if (user!.id === meetingData.conducted_by && supPrep?.private_notes) {
          setPrivateNotes(supPrep.private_notes);
        }
      }
      setSharedDuringMeeting(meetingData.shared_during_meeting || false);

      const { data: actionData, error: actionError } = await supabase
        .from("employee_meeting_action_items")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false });

      if (actionError) throw actionError;
      setActionItems((actionData || []) as ActionItem[]);
    } catch (error: any) {
      console.error("Error loading meeting:", error);
      toast({ title: "Fehler", description: "Besprechungsdaten konnten nicht geladen werden", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Debounced auto-save (3s after last change)
  const triggerAutoSave = useCallback(() => {
    dataChangedRef.current = true;
    setSaveState("unsaved");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveProtocol(true);
    }, 3000);
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const saveProtocol = async (isAutoSave = false) => {
    if (!meeting || !user) return;
    setSaving(true);
    setSaveState("saving");
    try {
      const updates: any = { protocol_data: protocolData };
      if (isEmployee) {
        updates.employee_preparation = { ...employeePrep, private_notes: privateNotes };
      } else if (isSupervisor) {
        updates.supervisor_preparation = { ...supervisorPrep, private_notes: privateNotes };
      }

      const { error } = await supabase
        .from("employee_meetings")
        .update(updates)
        .eq("id", meetingId);

      if (error) throw error;

      setSaveState("saved");
      setLastSaved(new Date());
      dataChangedRef.current = false;

      if (!isAutoSave) {
        toast({ title: "Gespeichert", description: "Protokoll wurde gespeichert" });
      }
    } catch (error: any) {
      console.error("Error saving protocol:", error);
      setSaveState("unsaved");
      if (!isAutoSave) {
        toast({ title: "Fehler", description: "Protokoll konnte nicht gespeichert werden", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const sharePreparation = async () => {
    if (!meeting) return;
    try {
      const { error } = await supabase.from("employee_meetings").update({ shared_during_meeting: true }).eq("id", meetingId);
      if (error) throw error;
      setSharedDuringMeeting(true);
      toast({ title: "Vorbereitung geteilt", description: "Beide Parteien können jetzt die Vorbereitungen sehen" });
    } catch (error: any) {
      console.error("Error sharing preparation:", error);
      toast({ title: "Fehler", description: "Vorbereitung konnte nicht geteilt werden", variant: "destructive" });
    }
  };

  const sendMeetingNotification = async (recipientId: string, title: string, message: string, type: string = "employee_meeting") => {
    if (!currentTenant) return;
    try {
      await supabase.rpc("create_notification", {
        user_id_param: recipientId,
        type_name: type,
        title_param: title,
        message_param: message,
        priority_param: "medium",
        data_param: JSON.stringify({ meeting_id: meetingId }),
      });
    } catch (e) {
      console.error("Notification error:", e);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!meeting) return;
    try {
      const updates: any = { status: newStatus };
      if (newStatus === "completed") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase.from("employee_meetings").update(updates).eq("id", meetingId);
      if (error) throw error;

      // Notifications
      if (newStatus === "in_progress") {
        sendMeetingNotification(meeting.employee_id, "Gespräch gestartet", `Ihr Mitarbeitergespräch wurde gestartet.`);
      }

      if (newStatus === "completed") {
        const { error: settingsError } = await supabase
          .from("employee_settings")
          .update({ last_meeting_date: meeting.meeting_date })
          .eq("user_id", meeting.employee_id);
        if (settingsError) console.error("Error updating employee_settings:", settingsError);

        sendMeetingNotification(meeting.employee_id, "Gespräch abgeschlossen", `Ihr Mitarbeitergespräch wurde abgeschlossen.`);

        const openItems = actionItems.filter(i => i.status !== "completed");
        if (openItems.length > 0) {
          toast({ title: "Gespräch abgeschlossen", description: `Hinweis: Es gibt noch ${openItems.length} offene Maßnahme(n).` });
        } else {
          toast({ title: "Abgeschlossen", description: "Gespräch wurde als abgeschlossen markiert" });
        }
      } else {
        toast({ 
          title: newStatus === "in_progress" ? "Gestartet" : "Aktualisiert", 
          description: newStatus === "in_progress" ? "Gespräch wurde gestartet" : "Status aktualisiert" 
        });
      }

      loadMeetingData();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({ title: "Fehler", description: "Status konnte nicht aktualisiert werden", variant: "destructive" });
    }
  };

  const cancelMeeting = async (reason: string) => {
    if (!meeting) return;
    try {
      const newStatus = isSupervisor ? "cancelled" : "cancelled_by_employee";
      const { error } = await supabase.from("employee_meetings")
        .update({ status: newStatus, cancellation_reason: reason })
        .eq("id", meetingId);
      if (error) throw error;

      const recipientId = isSupervisor ? meeting.employee_id : meeting.conducted_by;
      const dateStr = format(new Date(meeting.meeting_date), "dd.MM.yyyy", { locale: de });
      const senderName = isSupervisor ? meeting.supervisor_name : meeting.employee_name;

      if (isSupervisor) {
        sendMeetingNotification(recipientId, "Gespräch abgesagt", `Ihr Gespräch am ${dateStr} wurde abgesagt. Grund: ${reason}`);
      } else {
        sendMeetingNotification(recipientId, "Gespräch abgesagt", `${senderName} hat das Gespräch am ${dateStr} abgesagt. Grund: ${reason}`);
      }

      toast({ title: "Abgesagt", description: "Gespräch wurde abgesagt" });
      loadMeetingData();
    } catch (error: any) {
      console.error("Error cancelling meeting:", error);
      toast({ title: "Fehler", description: "Gespräch konnte nicht abgesagt werden", variant: "destructive" });
    }
  };

  const requestReschedule = async (reason: string) => {
    if (!meeting) return;
    try {
      const { error } = await supabase.from("employee_meetings")
        .update({ reschedule_request_reason: reason })
        .eq("id", meetingId);
      if (error) throw error;

      sendMeetingNotification(
        meeting.conducted_by,
        "Umterminierung angefragt",
        `${meeting.employee_name} möchte das Gespräch am ${format(new Date(meeting.meeting_date), "dd.MM.yyyy", { locale: de })} umterminieren. Grund: ${reason}`
      );

      toast({ title: "Anfrage gesendet", description: "Umterminierungsanfrage wurde an den Vorgesetzten gesendet" });
    } catch (error: any) {
      console.error("Error requesting reschedule:", error);
      toast({ title: "Fehler", description: "Anfrage konnte nicht gesendet werden", variant: "destructive" });
    }
  };

  const addActionItem = async () => {
    if (!newActionItem.description.trim() || !currentTenant) return;
    try {
      const { data, error } = await supabase
        .from("employee_meeting_action_items")
        .insert({
          meeting_id: meetingId,
          tenant_id: currentTenant.id,
          description: newActionItem.description,
          owner: newActionItem.owner,
          assigned_to: newActionItem.assigned_to || (isEmployee ? meeting.employee_id : meeting.conducted_by),
          due_date: newActionItem.due_date,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;
      setActionItems([data as ActionItem, ...actionItems]);
      setNewActionItem({ description: "", owner: "employee", status: "open" });
      toast({ title: "Action Item hinzugefügt", description: "Neue Maßnahme wurde erfolgreich erstellt" });
    } catch (error: any) {
      console.error("Error adding action item:", error);
      toast({ title: "Fehler", description: "Action Item konnte nicht erstellt werden", variant: "destructive" });
    }
  };

  const updateActionItem = async (itemId: string, updates: Partial<ActionItem>) => {
    try {
      const { error } = await supabase.from("employee_meeting_action_items").update(updates).eq("id", itemId);
      if (error) throw error;
      setActionItems(actionItems.map(item => item.id === itemId ? { ...item, ...updates } : item));
      toast({ title: "Aktualisiert", description: "Action Item wurde aktualisiert" });
    } catch (error: any) {
      console.error("Error updating action item:", error);
      toast({ title: "Fehler", description: "Action Item konnte nicht aktualisiert werden", variant: "destructive" });
    }
  };

  const deleteActionItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from("employee_meeting_action_items").delete().eq("id", itemId);
      if (error) throw error;
      setActionItems(actionItems.filter(item => item.id !== itemId));
      toast({ title: "Gelöscht", description: "Action Item wurde entfernt" });
    } catch (error: any) {
      console.error("Error deleting action item:", error);
      toast({ title: "Fehler", description: "Action Item konnte nicht gelöscht werden", variant: "destructive" });
    }
  };

  const updateProtocolField = useCallback((field: keyof ProtocolData, value: string | number) => {
    setProtocolData(prev => {
      const next = { ...prev, [field]: value };
      return next;
    });
    triggerAutoSave();
  }, [triggerAutoSave]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-muted-foreground">Lade Protokoll...</span>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center space-y-4">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium">Gespräch nicht gefunden</h3>
        {onBack && <Button onClick={onBack} variant="outline">Zurück</Button>}
      </div>
    );
  }

  const isCompleted = meeting.status === "completed";
  const isScheduled = meeting.status === "scheduled";
  const isInProgress = meeting.status === "in_progress";
  const isCancelled = meeting.status === "cancelled" || meeting.status === "cancelled_by_employee" || meeting.status === "rescheduled";
  const canEdit = !isCompleted && !isCancelled && (isEmployee || isSupervisor);

  return (
    <div className="space-y-6">
      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gespräch absagen</DialogTitle>
            <DialogDescription>Bitte geben Sie einen Grund für die Absage an.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Grund der Absage..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Abbrechen</Button>
            <Button variant="destructive" disabled={!cancelReason.trim()} onClick={() => { cancelMeeting(cancelReason); setCancelDialogOpen(false); setCancelReason(""); }}>
              Absagen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Request Dialog (Employee) */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Umterminierung anfragen</DialogTitle>
            <DialogDescription>Teilen Sie Ihrem Vorgesetzten mit, warum Sie eine Umterminierung wünschen.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rescheduleReason}
            onChange={(e) => setRescheduleReason(e.target.value)}
            placeholder="Grund für die Umterminierung..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>Abbrechen</Button>
            <Button disabled={!rescheduleReason.trim()} onClick={() => { requestReschedule(rescheduleReason); setRescheduleDialogOpen(false); setRescheduleReason(""); }}>
              Anfrage senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gesprächsprotokoll</h1>
            <p className="text-muted-foreground">
              {meeting.employee_name || "Mitarbeiter"} • {format(new Date(meeting.meeting_date), "PPP", { locale: de })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SaveIndicator state={saveState} lastSaved={lastSaved} />
            {isCompleted && (
              <EmployeeMeetingPDFExport
                meeting={meeting}
                protocolData={protocolData}
                actionItems={actionItems}
                employeePrep={employeePrep}
                supervisorPrep={supervisorPrep}
              />
            )}
          </div>
        </div>

        {/* Status progress + action buttons */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <StatusProgress status={meeting.status} />
          <div className="flex gap-2">
            {isScheduled && isSupervisor && (
              <Button onClick={() => updateStatus("in_progress")} size="sm">
                <Play className="h-4 w-4 mr-1" />
                Gespräch starten
              </Button>
            )}
            {isScheduled && isSupervisor && (
              <Button onClick={() => setCancelDialogOpen(true)} size="sm" variant="destructive">
                <XCircle className="h-4 w-4 mr-1" />
                Absagen
              </Button>
            )}
            {isScheduled && isEmployee && (
              <>
                <Button onClick={() => setCancelDialogOpen(true)} size="sm" variant="destructive">
                  <XCircle className="h-4 w-4 mr-1" />
                  Absagen
                </Button>
                <Button onClick={() => setRescheduleDialogOpen(true)} size="sm" variant="outline">
                  <CalendarClock className="h-4 w-4 mr-1" />
                  Umterminieren anfragen
                </Button>
              </>
            )}
            {isInProgress && isSupervisor && (
              <Button onClick={() => updateStatus("completed")} size="sm" variant="default">
                <Check className="h-4 w-4 mr-1" />
                Gespräch abschließen
              </Button>
            )}
          </div>
        </div>

        {/* Cancellation info */}
        {isCancelled && meeting.cancellation_reason && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-3">
              <p className="text-sm"><span className="font-medium">Absagegrund:</span> {meeting.cancellation_reason}</p>
            </CardContent>
          </Card>
        )}

        {/* Reschedule request info */}
        {meeting.reschedule_request_reason && !isCancelled && (
          <Card className="border-accent bg-accent/5">
            <CardContent className="py-3">
              <p className="text-sm"><span className="font-medium">Umterminierungsanfrage:</span> {meeting.reschedule_request_reason}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="preparation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="preparation">Vorbereitung</TabsTrigger>
          <TabsTrigger value="protocol">Protokoll</TabsTrigger>
          <TabsTrigger value="actions">Maßnahmen ({actionItems.length})</TabsTrigger>
        </TabsList>

        {/* Tab: Vorbereitung */}
        <TabsContent value="preparation" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Vorbereitung</CardTitle>
                {!sharedDuringMeeting && canEdit && (
                  <Button onClick={sharePreparation} size="sm" variant="outline">
                    <Unlock className="h-4 w-4 mr-2" />
                    Vorbereitung teilen
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Employee preparation */}
              <div>
                <h3 className="font-semibold mb-2">Vorbereitung Mitarbeiter</h3>
                {sharedDuringMeeting || isEmployee ? (
                  isEmployee && !isCompleted ? (
                    <SimpleRichTextEditor
                      initialContent={employeePrep.notes || ""}
                      onChange={(html) => {
                        setEmployeePrep({ ...employeePrep, notes: html });
                        triggerAutoSave();
                      }}
                      placeholder="Notizen zur Vorbereitung..."
                      disabled={isCompleted}
                      minHeight="120px"
                    />
                  ) : (
                    <RichTextDisplay content={employeePrep.notes || "Keine Vorbereitung"} />
                  )
                ) : (
                  <div className="text-sm text-muted-foreground italic p-4 border rounded-md">
                    Vorbereitung noch nicht geteilt
                  </div>
                )}
              </div>

              {/* Supervisor preparation */}
              <div>
                <h3 className="font-semibold mb-2">Vorbereitung Vorgesetzter</h3>
                {sharedDuringMeeting || isSupervisor ? (
                  isSupervisor && !isCompleted ? (
                    <SimpleRichTextEditor
                      initialContent={supervisorPrep.notes || ""}
                      onChange={(html) => {
                        setSupervisorPrep({ ...supervisorPrep, notes: html });
                        triggerAutoSave();
                      }}
                      placeholder="Notizen zur Vorbereitung..."
                      disabled={isCompleted}
                      minHeight="120px"
                    />
                  ) : (
                    <RichTextDisplay content={supervisorPrep.notes || "Keine Vorbereitung"} />
                  )
                ) : (
                  <div className="text-sm text-muted-foreground italic p-4 border rounded-md">
                    Vorbereitung noch nicht geteilt
                  </div>
                )}
              </div>

              {/* Private notes */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Meine privaten Notizen
                </h3>
                {!isCompleted ? (
                  <SimpleRichTextEditor
                    initialContent={privateNotes}
                    onChange={(html) => {
                      setPrivateNotes(html);
                      triggerAutoSave();
                    }}
                    placeholder="Nur für Sie sichtbar..."
                    disabled={isCompleted}
                    minHeight="80px"
                  />
                ) : (
                  <RichTextDisplay content={privateNotes || "Keine Notizen"} />
                )}
              </div>

              {canEdit && (
                <Button onClick={() => saveProtocol(false)} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Speichere..." : "Speichern"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Protokoll */}
        <TabsContent value="protocol" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Strukturiertes Protokoll</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Befinden & Work-Life-Balance */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Befinden & Work-Life-Balance</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Zufriedenheit</Label>
                    <RatingScale
                      value={protocolData.wellbeing_mood_rating}
                      onChange={(v) => updateProtocolField("wellbeing_mood_rating", v)}
                      disabled={!canEdit}
                      labels={["Sehr unzufrieden", "Sehr zufrieden"]}
                    />
                    <ProtocolField
                      label="Stimmung (Details)"
                      value={protocolData.wellbeing_mood}
                      onChange={(v) => updateProtocolField("wellbeing_mood", v)}
                      canEdit={canEdit}
                      placeholder="Wie geht es Ihnen aktuell?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Arbeitsbelastung</Label>
                    <RatingScale
                      value={protocolData.wellbeing_workload_rating}
                      onChange={(v) => updateProtocolField("wellbeing_workload_rating", v)}
                      disabled={!canEdit}
                      labels={["Zu wenig", "Überlastet"]}
                    />
                    <ProtocolField
                      label="Details zur Belastung"
                      value={protocolData.wellbeing_workload}
                      onChange={(v) => updateProtocolField("wellbeing_workload", v)}
                      canEdit={canEdit}
                      placeholder="Wie empfinden Sie die aktuelle Arbeitsbelastung?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Work-Life-Balance</Label>
                    <RatingScale
                      value={protocolData.wellbeing_balance_rating}
                      onChange={(v) => updateProtocolField("wellbeing_balance_rating", v)}
                      disabled={!canEdit}
                      labels={["Sehr schlecht", "Sehr gut"]}
                    />
                    <ProtocolField
                      label="Details zur Balance"
                      value={protocolData.wellbeing_balance}
                      onChange={(v) => updateProtocolField("wellbeing_balance", v)}
                      canEdit={canEdit}
                      placeholder="Wie ist Ihre Work-Life-Balance?"
                    />
                  </div>
                </div>
              </div>

              {/* Rückblick */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Rückblick</h3>
                <div className="space-y-3">
                  <ProtocolField label="Erfolge" value={protocolData.review_successes} onChange={(v) => updateProtocolField("review_successes", v)} canEdit={canEdit} placeholder="Was lief besonders gut?" />
                  <ProtocolField label="Herausforderungen" value={protocolData.review_challenges} onChange={(v) => updateProtocolField("review_challenges", v)} canEdit={canEdit} placeholder="Welche Schwierigkeiten gab es?" />
                  <ProtocolField label="Learnings" value={protocolData.review_learnings} onChange={(v) => updateProtocolField("review_learnings", v)} canEdit={canEdit} placeholder="Was haben wir gelernt?" />
                </div>
              </div>

              {/* Aktuelle Projekte */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Aktuelle Projekte</h3>
                <div className="space-y-3">
                  <ProtocolField label="Status" value={protocolData.projects_status} onChange={(v) => updateProtocolField("projects_status", v)} canEdit={canEdit} placeholder="Aktueller Stand der Projekte" />
                  <ProtocolField label="Blocker" value={protocolData.projects_blockers} onChange={(v) => updateProtocolField("projects_blockers", v)} canEdit={canEdit} placeholder="Was blockiert den Fortschritt?" />
                  <ProtocolField label="Benötigte Unterstützung" value={protocolData.projects_support} onChange={(v) => updateProtocolField("projects_support", v)} canEdit={canEdit} placeholder="Welche Hilfe wird benötigt?" />
                </div>
              </div>

              {/* Entwicklung */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Entwicklung & Karriere</h3>
                <div className="space-y-3">
                  <ProtocolField label="Skills & Kompetenzen" value={protocolData.development_skills} onChange={(v) => updateProtocolField("development_skills", v)} canEdit={canEdit} placeholder="Welche Fähigkeiten sollen entwickelt werden?" />
                  <ProtocolField label="Weiterbildung" value={protocolData.development_training} onChange={(v) => updateProtocolField("development_training", v)} canEdit={canEdit} placeholder="Welche Schulungen/Trainings sind geplant?" />
                  <ProtocolField label="Karriereziele" value={protocolData.development_career} onChange={(v) => updateProtocolField("development_career", v)} canEdit={canEdit} placeholder="Langfristige Ziele und Perspektiven" />
                </div>
              </div>

              {/* Team */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Team & Zusammenarbeit</h3>
                <div className="space-y-3">
                  <ProtocolField label="Team-Dynamik" value={protocolData.team_dynamics} onChange={(v) => updateProtocolField("team_dynamics", v)} canEdit={canEdit} placeholder="Wie läuft die Zusammenarbeit im Team?" />
                  <ProtocolField label="Kommunikation" value={protocolData.team_communication} onChange={(v) => updateProtocolField("team_communication", v)} canEdit={canEdit} placeholder="Wie ist die Kommunikation?" />
                </div>
              </div>

              {/* Ziele */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Zielvereinbarungen</h3>
                <ProtocolField label="" value={protocolData.goals} onChange={(v) => updateProtocolField("goals", v)} canEdit={canEdit} placeholder="Konkrete Ziele mit Deadlines und Erfolgskriterien" minHeight="100px" />
              </div>

              {/* Feedback */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Beidseitiges Feedback</h3>
                <ProtocolField label="" value={protocolData.feedback_mutual} onChange={(v) => updateProtocolField("feedback_mutual", v)} canEdit={canEdit} placeholder="Wechselseitiges Feedback" minHeight="100px" />
              </div>

              {/* Nächste Schritte */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Nächste Schritte</h3>
                <ProtocolField label="" value={protocolData.next_steps} onChange={(v) => updateProtocolField("next_steps", v)} canEdit={canEdit} placeholder="Was sind die nächsten konkreten Schritte?" />
              </div>

              <div className="flex gap-2 pt-4">
                {canEdit && (
                  <Button onClick={() => saveProtocol(false)} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Speichere..." : "Speichern"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Action Items */}
        <TabsContent value="actions" className="space-y-4">
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Neue Maßnahme hinzufügen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Beschreibung</Label>
                  <SimpleRichTextEditor
                    initialContent=""
                    onChange={(html) => setNewActionItem(prev => ({ ...prev, description: html }))}
                    placeholder="Was muss getan werden?"
                    minHeight="60px"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Verantwortlich</Label>
                    <Select value={newActionItem.owner} onValueChange={(value: any) => setNewActionItem({ ...newActionItem, owner: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Mitarbeiter</SelectItem>
                        <SelectItem value="supervisor">Vorgesetzter</SelectItem>
                        <SelectItem value="both">Beide</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fälligkeitsdatum</Label>
                    <Input type="date" value={newActionItem.due_date || ""} onChange={(e) => setNewActionItem({ ...newActionItem, due_date: e.target.value })} />
                  </div>
                </div>
                <Button onClick={addActionItem} disabled={!newActionItem.description.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Hinzufügen
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {actionItems.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Noch keine Maßnahmen vorhanden
                </CardContent>
              </Card>
            ) : (
              actionItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === "completed" ? "default" : "secondary"}>
                            {item.owner === "employee" ? "Mitarbeiter" : item.owner === "supervisor" ? "Vorgesetzter" : "Beide"}
                          </Badge>
                          <Badge variant={item.status === "completed" ? "default" : item.status === "in_progress" ? "secondary" : "outline"}>
                            {item.status === "completed" ? "Erledigt" : item.status === "in_progress" ? "In Arbeit" : "Offen"}
                          </Badge>
                          {item.due_date && (
                            <span className="text-sm text-muted-foreground">
                              Fällig: {format(new Date(item.due_date), "dd.MM.yyyy", { locale: de })}
                            </span>
                          )}
                        </div>
                        <RichTextDisplay content={item.description} />
                        {item.notes && <RichTextDisplay content={item.notes} className="italic" />}
                        {canEdit && item.status !== "completed" && (
                          <div className="flex gap-2 mt-2">
                            {item.status === "open" && (
                              <Button size="sm" variant="outline" onClick={() => updateActionItem(item.id!, { status: "in_progress" })}>
                                In Arbeit
                              </Button>
                            )}
                            {item.status === "in_progress" && (
                              <Button size="sm" variant="default" onClick={() => updateActionItem(item.id!, { status: "completed", completed_at: new Date().toISOString() })}>
                                <Check className="h-4 w-4 mr-1" />
                                Erledigt
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {canEdit && isSupervisor && (
                        <Button size="sm" variant="ghost" onClick={() => deleteActionItem(item.id!)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
