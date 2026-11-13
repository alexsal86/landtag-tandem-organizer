import { useState, useEffect, useCallback, useRef } from "react";
import { debugConsole } from '@/utils/debugConsole';
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Save, Check, Lock, Unlock, Plus, Trash2, Play, Loader2, XCircle, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeMeetingPDFExport } from "@/features/employees/components/EmployeeMeetingPDFExport";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import type { ActionItem, ActionItemOwner, EmployeeMeeting, MeetingPreparationData, ProtocolData } from "@/components/employees/types";

import {
  RatingScale,
  StatusProgress,
  SaveIndicator,
  ProtocolField,
} from "./employeeMeetingProtocol/parts";
import { ACTION_ITEM_MIN_LENGTH, extractPlainTextFromHtml } from "../protocolText";
import type { Json } from "@/integrations/supabase/types";
import type { WellbeingPoint } from "../wellbeing";
import { WellbeingTrend } from "./WellbeingTrend";
import { isPreparationAvailable, suggestPreparationFields } from "../preparation";
import { getPreviousMeetingContext, type PreviousMeetingContext } from "../previousMeeting";
import { PreviousMeetingReview } from "./PreviousMeetingReview";
import { resolveActionTaskResponsibility } from "../actionTasks";
import { Link } from "react-router-dom";
import { canEditProtocol, isProtocolLocked } from "../protocolWorkflow";
import { getErrorMessage } from "@/utils/errorHandler";
import { notify } from "@/lib/notify";

interface EmployeeMeetingProtocolProps {
  meetingId: string;
  onBack?: () => void;
}

export function EmployeeMeetingProtocol({ meetingId, onBack }: EmployeeMeetingProtocolProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [trendPoints, setTrendPoints] = useState<WellbeingPoint[]>([]);
  const [previousContext, setPreviousContext] = useState<PreviousMeetingContext>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowComment, setWorkflowComment] = useState("");
  const versionRef = useRef(0);
  const changeRef = useRef(0);
  const conflictRef = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meeting, setMeeting] = useState<EmployeeMeeting | null>(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);

  // Protocol data
  const [protocolData, setProtocolData] = useState<ProtocolData>({});
  const [employeePrep, setEmployeePrep] = useState<MeetingPreparationData>({});
  const [supervisorPrep, setSupervisorPrep] = useState<MeetingPreparationData>({});
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
  const saveProtocolRef = useRef<(isAutoSave?: boolean) => Promise<boolean>>(async () => false);
  const savingRef = useRef(false);
  const dataChangedRef = useRef(false);

  // Cancel/reschedule dialog state (must be before early returns)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");

  const userId = user?.id;
  const loadMeetingData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      dataChangedRef.current = false;
      // Fetch meeting without profile joins (FK points to auth.users, not profiles)
      const { data: meetingData, error: meetingError } = await supabase
        .from("employee_meetings")
        .select("id, employee_id, conducted_by, tenant_id, meeting_date, next_meeting_due, meeting_type, status, protocol, employee_notes, supervisor_notes, action_items, created_at, updated_at, employee_preparation, supervisor_preparation, shared_during_meeting, protocol_data, cancellation_reason, reschedule_request_reason, completed_at, version, acknowledgement_requested_at, acknowledged_at, acknowledged_by, protocol_hash, acknowledgement_comment")
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

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) || []);

      const enrichedMeeting = {
        ...meetingData,
        employee_name: profileMap.get(meetingData.employee_id) || "Mitarbeiter",
        supervisor_name: profileMap.get(meetingData.conducted_by) || "Vorgesetzter",
      };

      setMeeting(enrichedMeeting as EmployeeMeeting);
      versionRef.current = meetingData.version;
      conflictRef.current = false;
      setHasConflict(false);
      setSaveState("saved");
      const { data: privateData, error: privateError } = await supabase.from("employee_meeting_private_notes").select("notes").eq("meeting_id", meetingId).eq("user_id", userId!).maybeSingle();
      if (privateError) throw privateError;
      setPrivateNotes(privateData?.notes ?? "");
      const { data: tenantAdmin, error: adminError } = await supabase.rpc("is_tenant_admin", { _tenant_id: meetingData.tenant_id, _user_id: userId! });
      if (adminError) throw adminError;
      setIsTenantAdmin(tenantAdmin);
      const uid = userId;
      setIsEmployee(meetingData.employee_id === uid);
      setIsSupervisor(meetingData.conducted_by === uid);

      setProtocolData({});
      setEmployeePrep({});
      setSupervisorPrep({});
      if (meetingData.protocol_data) {
        setProtocolData(meetingData.protocol_data as ProtocolData);
      }
      if (meetingData.employee_preparation) {
        const empPrep = meetingData.employee_preparation as MeetingPreparationData;
        setEmployeePrep(empPrep);
      }
      if (meetingData.supervisor_preparation) {
        const supPrep = meetingData.supervisor_preparation as MeetingPreparationData;
        setSupervisorPrep(supPrep);
      }
      setSharedDuringMeeting(meetingData.shared_during_meeting || false);
      const { data: trend, error: trendError } = await supabase.rpc("get_employee_meeting_trend", { p_employee_id: meetingData.employee_id, p_tenant_id: meetingData.tenant_id });
      setTrendPoints(trendError ? [] : trend ?? []);


      const { data: actionData, error: actionError } = await supabase
        .from("employee_meeting_action_items")
        .select("id, meeting_id, tenant_id, description, owner, assigned_to, due_date, status, completed_at, notes, created_at, updated_at, task_id")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false });

      if (actionError) throw actionError;
      setActionItems((actionData || []) as ActionItem[]);
      const { data: priorMeetings, error: priorError } = await supabase.from("employee_meetings").select("id, employee_id, conducted_by, meeting_date, meeting_type, status, protocol_data, version")
        .eq("employee_id", meetingData.employee_id).eq("tenant_id", meetingData.tenant_id)
        .in("status", ["completed", "acknowledged"]).lt("meeting_date", meetingData.meeting_date)
        .order("meeting_date", { ascending: false }).order("id", { ascending: false }).limit(1);
      if (priorError) throw priorError;
      const previous = priorMeetings?.[0];
      const priorActions = previous ? await supabase.from("employee_meeting_action_items").select("id, meeting_id, description, owner, assigned_to, due_date, status, completed_at, task_id").eq("meeting_id", previous.id) : null;
      if (priorActions?.error) throw priorActions.error;
      setPreviousContext(getPreviousMeetingContext(meetingData.employee_id, meetingData, (priorMeetings ?? []) as EmployeeMeeting[], (priorActions?.data ?? []) as ActionItem[]));

    } catch (error: unknown) {
      setLoadError(true);
      debugConsole.error("Error loading meeting:", error);
      notify.error("Fehler", { description: "Besprechungsdaten konnten nicht geladen werden"
});
    } finally {
      setLoading(false);
    }
  }, [meetingId, userId]);

  useEffect(() => {
    if (meetingId && userId) void loadMeetingData();
  }, [meetingId, userId, loadMeetingData]);

  useEffect(() => {
    if (!meetingId || !userId) return;
    let active = true;
    const channel = supabase.channel(`employee-actions-${meetingId}`).on("postgres_changes", {
      event: "*", schema: "public", table: "employee_meeting_action_items", filter: `meeting_id=eq.${meetingId}`,
    }, async () => {
      const { data, error } = await supabase.from("employee_meeting_action_items")
        .select("id, meeting_id, tenant_id, description, owner, assigned_to, due_date, status, completed_at, notes, created_at, updated_at, task_id")
        .eq("meeting_id", meetingId).order("created_at", { ascending: false });
      if (active && !error) setActionItems((data ?? []) as ActionItem[]);
    }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [meetingId, userId]);

  const saveProtocol = useCallback(async (isAutoSave = false) => {
    if (!meeting || !user || !canEditProtocol(meeting.status) || conflictRef.current || savingRef.current) return false;
    const savedChange = changeRef.current;
    savingRef.current = true;
    setSaving(true);
    setSaveState("saving");
    try {
      const updates: {
      protocol_data: ProtocolData;
      employee_preparation?: MeetingPreparationData;
      supervisor_preparation?: MeetingPreparationData;
    } = { protocol_data: protocolData };
      if (isEmployee) {
        updates.employee_preparation = employeePrep;
      } else if (isSupervisor) {
        updates.supervisor_preparation = supervisorPrep;
      }

      const { data, error } = await supabase.rpc("save_employee_meeting", {
        p_meeting_id: meetingId, p_version: versionRef.current, p_patch: updates as Json, p_private_notes: privateNotes,
      });
      if (error) {
        if (error.code === "40001") { conflictRef.current = true; setHasConflict(true); }
        throw error;
      }
      versionRef.current = data;
      const stillDirty = savedChange !== changeRef.current;
      setSaveState(stillDirty ? "unsaved" : "saved");
      setLastSaved(new Date());
      dataChangedRef.current = stillDirty;
      if (stillDirty) autoSaveTimerRef.current = setTimeout(() => void saveProtocolRef.current(true), 3000);
      if (!isAutoSave) {
        notify.success("Gespeichert", { description: "Protokoll wurde gespeichert" 
});
      }
      return !stillDirty;
    } catch (error: unknown) {
      debugConsole.error("Error saving protocol:", error);
      setSaveState("unsaved");
      if (!isAutoSave || conflictRef.current) {
        notify.error("Speichern fehlgeschlagen", { description: conflictRef.current ? "Parallel geändert. Bitte lokale Änderungen sichern und das Gespräch neu laden." : "Protokoll konnte nicht gespeichert werden"
});
      }
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [meeting, user, protocolData, employeePrep, supervisorPrep, privateNotes, isEmployee, isSupervisor, meetingId]);

  useEffect(() => {
    saveProtocolRef.current = saveProtocol;
  }, [saveProtocol]);

  // Debounced auto-save (3s after last change)
  const triggerAutoSave = useCallback(() => {
    changeRef.current += 1;
    dataChangedRef.current = true;
    setSaveState("unsaved");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void saveProtocolRef.current(true);
    }, 3000);
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const savePatch = async (patch: Json) => {
    if (savingRef.current || conflictRef.current) throw new Error("Bitte den laufenden Speichervorgang abwarten oder neu laden.");
    setWorkflowBusy(true);
    try {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (dataChangedRef.current && !await saveProtocolRef.current()) throw new Error("Ungespeicherte Änderungen");
      savingRef.current = true;
      setSaving(true);
      const { data, error } = await supabase.rpc("save_employee_meeting", { p_meeting_id: meetingId, p_version: versionRef.current, p_patch: patch });
      if (error) {
        if (error.code === "40001") { conflictRef.current = true; setHasConflict(true); }
        throw error;
      }
      versionRef.current = data;
    } finally { savingRef.current = false; setSaving(false); setWorkflowBusy(false); }
  };

  const protocolWorkflow = async (action: "request" | "acknowledge" | "object" | "reopen") => {
    if (workflowBusy || savingRef.current) return;
    setWorkflowBusy(true);
    try {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (dataChangedRef.current && !await saveProtocolRef.current()) throw new Error("Bitte Änderungen zuerst speichern.");
      const result = action === "request" ? await supabase.rpc("request_protocol_acknowledgement", { p_meeting_id: meetingId })
        : action === "reopen" ? await supabase.rpc("reopen_meeting_protocol", { p_meeting_id: meetingId, p_reason: workflowComment })
        : await supabase.rpc("acknowledge_meeting_protocol", { p_meeting_id: meetingId, p_protocol_hash: meeting?.protocol_hash ?? undefined, ...(action === "object" ? { p_comment: workflowComment } : {}) });
      if (result.error) throw result.error;
      setWorkflowComment("");
      await loadMeetingData();
      notify.success("Protokoll aktualisiert");
    } catch (error: unknown) {
      notify.error("Protokoll konnte nicht aktualisiert werden", { description: getErrorMessage(error) });
    } finally { setWorkflowBusy(false); }
  };

  const sharePreparation = async () => {
    if (!meeting) return;
    try {
      await savePatch({ shared_during_meeting: true });
      setSharedDuringMeeting(true);
      notify.success("Vorbereitung geteilt", { description: "Beide Parteien können jetzt die Vorbereitungen sehen" 
});
    } catch (error: unknown) {
      debugConsole.error("Error sharing preparation:", error);
      notify.error("Fehler", { description: "Vorbereitung konnte nicht geteilt werden"
});
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!meeting) return;
    try {
      await savePatch({ status: newStatus });

      if (newStatus === "completed") {

        const openItems = actionItems.filter(i => i.status !== "completed");
        if (openItems.length > 0) {
          notify.success("Gespräch abgeschlossen", { description: `Hinweis: Es gibt noch ${openItems.length} offene Maßnahme(n).` 
});
        } else {
          notify.success("Abgeschlossen", { description: "Gespräch wurde als abgeschlossen markiert" 
});
        }
      } else {
        notify.success(newStatus === "in_progress" ? "Gestartet" : "Aktualisiert", { 
          description: newStatus === "in_progress" ? "Gespräch wurde gestartet" : "Status aktualisiert" 
        
});
      }

      loadMeetingData();
    } catch (error: unknown) {
      debugConsole.error("Error updating status:", error);
      notify.error("Fehler", { description: "Status konnte nicht aktualisiert werden"
});
    }
  };

  const cancelMeeting = async (reason: string) => {
    if (!meeting) return;
    try {
      const newStatus = isSupervisor || isTenantAdmin ? "cancelled" : "cancelled_by_employee";
      await savePatch({ status: newStatus, cancellation_reason: reason });

      notify.success("Abgesagt", { description: "Gespräch wurde abgesagt" 
});
      loadMeetingData();
    } catch (error: unknown) {
      debugConsole.error("Error cancelling meeting:", error);
      notify.error("Fehler", { description: "Gespräch konnte nicht abgesagt werden"
});
    }
  };

  const requestReschedule = async (reason: string) => {
    if (!meeting) return;
    try {
      await savePatch({ reschedule_request_reason: reason });

      notify.success("Anfrage gesendet", { description: "Umterminierungsanfrage wurde an den Vorgesetzten gesendet" 
});
    } catch (error: unknown) {
      debugConsole.error("Error requesting reschedule:", error);
      notify.error("Fehler", { description: "Anfrage konnte nicht gesendet werden"
});
    }
  };

  const addActionItem = async () => {
    if (!currentTenant || savingRef.current || workflowBusy) return;

    const plainDescription = extractPlainTextFromHtml(newActionItem.description);
    if (!plainDescription) {
      notify.error("Validierung", {
        description: "Bitte eine Maßnahme mit Inhalt eingeben."
});
      return;
    }

    if (plainDescription.length < ACTION_ITEM_MIN_LENGTH) {
      notify.error("Validierung", {
        description: `Bitte mindestens ${ACTION_ITEM_MIN_LENGTH} Zeichen eingeben.`
});
      return;
    }

    setWorkflowBusy(true);
    try {
      if (dataChangedRef.current && !await saveProtocolRef.current()) return;
      const { error } = await supabase.rpc("mutate_employee_meeting_action", { p_meeting_id: meetingId, p_action: "add", p_data: { description: newActionItem.description, owner: newActionItem.owner, due_date: newActionItem.due_date || null } });
      if (error) throw error;
      await loadMeetingData();
      setNewActionItem({ description: "", owner: "employee", status: "open" });
      notify.success("Action Item hinzugefügt", { description: "Neue Maßnahme wurde erfolgreich erstellt" 
});
    } catch (error: unknown) {
      debugConsole.error("Error adding action item:", error);
      notify.error("Fehler", { description: "Action Item konnte nicht erstellt werden"
});
    } finally { setWorkflowBusy(false); }
  };

  const updateActionItem = async (itemId: string, updates: Partial<ActionItem>) => {
    try {
      const { error } = await supabase.rpc("mutate_employee_meeting_action", { p_meeting_id: meetingId, p_action: "status", p_item_id: itemId, p_data: updates as Json });
      if (error) throw error;
      setActionItems(actionItems.map(item => item.id === itemId ? { ...item, ...updates } : item));
      notify.success("Aktualisiert", { description: "Action Item wurde aktualisiert" 
});
    } catch (error: unknown) {
      debugConsole.error("Error updating action item:", error);
      notify.error("Fehler", { description: "Action Item konnte nicht aktualisiert werden"
});
    }
  };

  const deleteActionItem = async (itemId: string) => {
    try {
      const { error } = await supabase.rpc("mutate_employee_meeting_action", { p_meeting_id: meetingId, p_action: "delete", p_item_id: itemId });
      if (error) throw error;
      setActionItems(actionItems.filter(item => item.id !== itemId));
      notify.success("Gelöscht", { description: "Action Item wurde entfernt" 
});
    } catch (error: unknown) {
      debugConsole.error("Error deleting action item:", error);
      notify.error("Fehler", { description: "Action Item konnte nicht gelöscht werden"
});
    }
  };

  const updateProtocolField = useCallback((field: keyof ProtocolData, value: string | number) => {
    setProtocolData(prev => {
      const next = { ...prev, [field]: value };
      return next;
    });
    triggerAutoSave();
  }, [triggerAutoSave]);

  const updatePreviousReason = (id: string, value: string) => {
    setProtocolData(prev => ({ ...prev, previous_action_reasons: { ...prev.previous_action_reasons, [id]: value } }));
    triggerAutoSave();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-muted-foreground">Lade Protokoll...</span>
      </div>
    );
  }

  if (loadError) return <Card><CardContent className="py-6 space-y-3"><p>Das Gespräch konnte nicht vollständig geladen werden. Bitte erneut versuchen.</p><Button onClick={() => void loadMeetingData()}>Erneut laden</Button></CardContent></Card>;

  if (!meeting) {
    return (
      <div className="text-center space-y-4">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium">Gespräch nicht gefunden</h3>
        {onBack && <Button onClick={onBack} variant="outline">Zurück</Button>}
      </div>
    );
  }

  const canManage = isSupervisor || isTenantAdmin;
  const isCompleted = meeting.status === "completed" || isProtocolLocked(meeting.status);
  const isScheduled = meeting.status === "scheduled";
  const isInProgress = meeting.status === "in_progress";
  const isCancelled = meeting.status === "cancelled" || meeting.status === "cancelled_by_employee" || meeting.status === "rescheduled";
  const preparationAvailable = isPreparationAvailable(meeting.meeting_date);
  const canEdit = canEditProtocol(meeting.status) && (isEmployee || isSupervisor || isTenantAdmin) && !workflowBusy && !hasConflict;

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
                employeePrep={sharedDuringMeeting || isEmployee ? employeePrep : undefined}
                supervisorPrep={sharedDuringMeeting || isSupervisor ? supervisorPrep : undefined}
              />
            )}
          </div>
        </div>

        {/* Status progress + action buttons */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <StatusProgress status={meeting.status} />
          <div className="flex gap-2">
            {isScheduled && canManage && (
              <Button onClick={() => updateStatus("in_progress")} size="sm">
                <Play className="h-4 w-4 mr-1" />
                Gespräch starten
              </Button>
            )}
            {isScheduled && canManage && (
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
            {isInProgress && canManage && (
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

      {hasConflict && <Card><CardContent className="pt-6 space-y-3">
        <p role="alert">Das Gespräch wurde parallel geändert. Automatisches Speichern ist angehalten. Sichern Sie Ihre lokalen Änderungen, bevor Sie den Serverstand laden.</p>
        <Button variant="outline" onClick={() => {
          const blob = new Blob([JSON.stringify({ protocol: protocolData, preparation: isEmployee ? employeePrep : supervisorPrep, private_notes: privateNotes }, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `gespraech-${meetingId}-lokaler-entwurf.json`; link.click(); URL.revokeObjectURL(url);
        }}>Lokalen Entwurf sichern</Button>
        <Button variant="outline" onClick={() => void loadMeetingData()}>Serverstand laden</Button>
      </CardContent></Card>}
      {(isProtocolLocked(meeting.status) || meeting.status === "completed") && (
        <Card><CardContent className="pt-6 space-y-3">
          {isProtocolLocked(meeting.status) && <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" />Protokoll gesperrt</Badge>}
          {meeting.status === "acknowledged" && <p>Bestätigt am {meeting.acknowledged_at && format(new Date(meeting.acknowledged_at), "dd.MM.yyyy HH:mm")} · Prüfsumme {meeting.protocol_hash?.slice(0, 12)}</p>}
          {meeting.acknowledgement_comment && <p className="text-sm">Einspruch/Ergänzung: {meeting.acknowledgement_comment}</p>}
          {meeting.status === "completed" && canManage && <Button disabled={workflowBusy || saving} onClick={() => void protocolWorkflow("request")}>Zur Bestätigung senden</Button>}
          {meeting.status === "pending_acknowledgement" && isEmployee && <>
            <p>Bitte das Protokoll innerhalb von 7 Tagen prüfen. Ein Einspruch hält die Bestätigung offen.</p>
            <Button disabled={workflowBusy || !!meeting.acknowledgement_comment} onClick={() => void protocolWorkflow("acknowledge")}>Gelesen &amp; Einverstanden</Button>
            <Label htmlFor="protocol-objection">Einspruch/Ergänzung</Label>
            <Textarea id="protocol-objection" value={workflowComment} onChange={e => setWorkflowComment(e.target.value)} />
            <Button variant="outline" disabled={workflowBusy || !workflowComment.trim()} onClick={() => void protocolWorkflow("object")}>Einspruch/Ergänzung senden</Button>
          </>}
          {canManage && <>
            <Label htmlFor="protocol-reopen">Grund für die Wiederöffnung</Label>
            <Textarea id="protocol-reopen" value={workflowComment} onChange={e => setWorkflowComment(e.target.value)} />
            <Button variant="outline" disabled={workflowBusy || !workflowComment.trim()} onClick={() => void protocolWorkflow("reopen")}>Protokoll wieder öffnen</Button>
          </>}
        </CardContent></Card>
      )}

      <Tabs defaultValue="preparation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="preparation">Vorbereitung</TabsTrigger>
          <TabsTrigger value="protocol">Protokoll</TabsTrigger>
          <TabsTrigger value="actions">Maßnahmen ({actionItems.length})</TabsTrigger>
        </TabsList>

        {/* Tab: Vorbereitung */}
        <TabsContent value="preparation" className="space-y-4">
          <PreviousMeetingReview context={previousContext} reasons={protocolData.previous_action_reasons ?? {}} onReason={updatePreviousReason} disabled={!canEdit} />
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
              {!preparationAvailable && <p className="text-sm text-muted-foreground">Der Vorbereitungsbogen wird 7 Tage vor dem Termin freigeschaltet.</p>}
              <div className={sharedDuringMeeting ? "grid gap-6 md:grid-cols-2" : "space-y-6"}>
              {/* Employee preparation */}
              <div>
                <h3 className="font-semibold mb-2">Vorbereitung Mitarbeiter</h3>
                {(sharedDuringMeeting || isEmployee) && <div className="space-y-3 mb-4">
                  {([
                    ["proud_of", "Worauf bin ich stolz?"],
                    ["need_support", "Wo brauche ich Unterstützung?"],
                    ["skills_to_deepen", "Welche Fähigkeiten möchte ich vertiefen?"],
                  ] as const).map(([field, label]) => <ProtocolField key={field} label={label} value={employeePrep[field]}
                    canEdit={canEdit && isEmployee && preparationAvailable} placeholder={label} onChange={value => { setEmployeePrep(prev => ({ ...prev, [field]: value })); triggerAutoSave(); }} />)}
                </div>}
                {sharedDuringMeeting || isEmployee ? (
                  isEmployee && canEdit && preparationAvailable ? (
                    <SimpleRichTextEditor
                      initialContent={employeePrep.notes || ""}
                      onChange={(html) => {
                        setEmployeePrep({ ...employeePrep, notes: html });
                        triggerAutoSave();
                      }}
                      placeholder="Notizen zur Vorbereitung..."
                      disabled={!canEdit}
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
                  isSupervisor && canEdit ? (
                    <SimpleRichTextEditor
                      initialContent={supervisorPrep.notes || ""}
                      onChange={(html) => {
                        setSupervisorPrep({ ...supervisorPrep, notes: html });
                        triggerAutoSave();
                      }}
                      placeholder="Notizen zur Vorbereitung..."
                      disabled={!canEdit}
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

              </div>
              {/* Private notes */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Meine privaten Notizen
                </h3>
                {canEdit ? (
                  <SimpleRichTextEditor
                    initialContent={privateNotes}
                    onChange={(html) => {
                      setPrivateNotes(html);
                      triggerAutoSave();
                    }}
                    placeholder="Nur für Sie sichtbar..."
                    disabled={!canEdit}
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
          <PreviousMeetingReview context={previousContext} reasons={protocolData.previous_action_reasons ?? {}} onReason={updatePreviousReason} disabled={!canEdit} />
          <Card>
            <CardHeader>
              <CardTitle>Strukturiertes Protokoll</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {canEdit && (isEmployee || sharedDuringMeeting) && <Button variant="outline" onClick={() => {
                setProtocolData(prev => suggestPreparationFields(prev, employeePrep)); triggerAutoSave();
              }}>Vorbereitung als Vorschlag in leere Protokollfelder übernehmen</Button>}
              <WellbeingTrend meetings={trendPoints} />
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
                    <Select value={newActionItem.owner} onValueChange={(value) => setNewActionItem({ ...newActionItem, owner: value as ActionItemOwner })}>
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
                <Button
                  onClick={addActionItem}
                  disabled={extractPlainTextFromHtml(newActionItem.description).length < ACTION_ITEM_MIN_LENGTH}
                >
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
                        {item.task_id && <Link className="text-sm text-primary underline" to={`/tasks?highlight=${item.task_id}`}>Aufgabe öffnen · Status wird synchronisiert</Link>}
                        {item.owner === "both" && <p className="text-xs text-muted-foreground">{resolveActionTaskResponsibility(item.owner, meeting.employee_id, meeting.conducted_by).ballAssigneeId === meeting.employee_id ? "Mitarbeiter führt, Gesprächsleitung wirkt mit." : "Gesprächsleitung führt."}</p>}
                        {item.notes && <RichTextDisplay content={item.notes} className="italic" />}
                        {(canEdit || (meeting.status === "acknowledged" && (isEmployee || isSupervisor))) && item.status !== "completed" && (
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
                      {canEdit && canManage && !item.task_id && (
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
