import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import type { TimeEntryRow, LeaveRow } from "../types";
import { MAX_PAUSE_MINUTES } from "../types";
import type { ChecklistItem } from "../VacationChecklistForm";

interface UseTimeTrackingOperationsParams {
  userId: string | null;
  loadData: () => void;
  vacationLeaves: LeaveRow[];
  medicalLeaves: LeaveRow[];
  overtimeLeaves: LeaveRow[];
}

export function useTimeTrackingOperations({
  userId,
  loadData,
  vacationLeaves,
  medicalLeaves,
  overtimeLeaves,
}: UseTimeTrackingOperationsParams) {
  // Entry form state
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [pauseMinutes, setPauseMinutes] = useState("30");
  const [notes, setNotes] = useState("");

  // Edit dialog
  const [editingEntry, setEditingEntry] = useState<TimeEntryRow | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Vacation form
  const [vacationStartDate, setVacationStartDate] = useState("");
  const [vacationEndDate, setVacationEndDate] = useState("");
  const [vacationReason, setVacationReason] = useState("");
  const [vacationDeputy, setVacationDeputy] = useState("");
  const [vacationChecklistItems, setVacationChecklistItems] = useState<ChecklistItem[]>([]);

  // Sick form
  const [sickStartDate, setSickStartDate] = useState("");
  const [sickEndDate, setSickEndDate] = useState("");
  const [sickNotes, setSickNotes] = useState("");
  const [sickDeputy, setSickDeputy] = useState("");

  // Medical form
  const [medicalDate, setMedicalDate] = useState("");
  const [medicalStartTime, setMedicalStartTime] = useState("");
  const [medicalEndTime, setMedicalEndTime] = useState("");
  const [medicalReason, setMedicalReason] = useState<string>("acute");
  const [medicalNotes, setMedicalNotes] = useState("");

  // Overtime form
  const [overtimeStartDate, setOvertimeStartDate] = useState("");
  const [overtimeEndDate, setOvertimeEndDate] = useState("");
  const [overtimeReason, setOvertimeReason] = useState("");

  // Confirm dialog
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const validateDailyLimit = async (workDate: string, grossMin: number, excludeId?: string) => {
    if (!userId) return;
    const { data } = await supabase.from("time_entries").select("id, started_at, ended_at").eq("user_id", userId).eq("work_date", workDate);
    const total = data?.reduce((s: Record<string, any>, e: Record<string, any>) => e.id === excludeId || !e.started_at || !e.ended_at ? s : s + (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 60000, 0) || 0;
    if (total + grossMin > 600) {
      const formatTime = (min: number) => `${Math.floor(min / 60)}:${(min % 60).toString().padStart(2, "0")}`;
      if (total > 0) throw new Error(`Bereits ${formatTime(total)} Stunden erfasst. Mit diesem Eintrag (${formatTime(grossMin)}) wären es ${formatTime(total + grossMin)} Stunden. Maximal 10 Stunden pro Tag erlaubt.`);
      else throw new Error(`Der Eintrag dauert ${formatTime(grossMin)} Stunden. Maximal 10 Stunden pro Tag erlaubt.`);
    }
  };

  const resetEntryForm = () => { setStartTime(""); setEndTime(""); setPauseMinutes("30"); setNotes(""); };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !startTime || !endTime) { toast.error("Bitte alle Felder ausfüllen"); return; }
    const start = new Date(`${entryDate}T${startTime}`), end = new Date(`${entryDate}T${endTime}`);
    if (end <= start) { toast.error("Endzeit nach Startzeit"); return; }
    const gross = Math.round((end.getTime() - start.getTime()) / 60000), pause = parseInt(pauseMinutes) || 0;
    if (pause < 0) { toast.error("Die Pausenzeit darf nicht negativ sein"); return; }
    if (pause > gross) { toast.error("Die Pause darf nicht länger als die Arbeitszeit sein"); return; }
    if (pause > MAX_PAUSE_MINUTES) { toast.error(`Die Pause darf maximal ${MAX_PAUSE_MINUTES} Minuten betragen`); return; }
    try {
      await validateDailyLimit(entryDate, gross);
      await supabase.from("time_entries").insert([{ user_id: userId, work_date: entryDate, started_at: start.toISOString(), ended_at: end.toISOString(), minutes: gross - pause, pause_minutes: pause, notes: notes || null }]);
      toast.success("Gespeichert"); resetEntryForm(); loadData();
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : "Fehler beim Speichern"); }
  };

  const handleEditEntry = (entry: TimeEntryRow) => {
    setEditingEntry(entry);
    setEntryDate(entry.work_date);
    setStartTime(entry.started_at ? format(parseISO(entry.started_at), "HH:mm") : "");
    setEndTime(entry.ended_at ? format(parseISO(entry.ended_at), "HH:mm") : "");
    setPauseMinutes((entry.pause_minutes || 30).toString());
    setNotes(entry.notes || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdateEntry = async () => {
    if (!userId || !editingEntry || !startTime || !endTime) { toast.error("Bitte alle Felder ausfüllen"); return; }
    const start = new Date(`${entryDate}T${startTime}`), end = new Date(`${entryDate}T${endTime}`);
    if (end <= start) { toast.error("Endzeit muss nach Startzeit liegen"); return; }
    const gross = Math.round((end.getTime() - start.getTime()) / 60000), pause = parseInt(pauseMinutes) || 0;
    if (pause < 0) { toast.error("Die Pausenzeit darf nicht negativ sein"); return; }
    if (pause > gross) { toast.error("Die Pause darf nicht länger als die Arbeitszeit sein"); return; }
    if (pause > MAX_PAUSE_MINUTES) { toast.error(`Die Pause darf maximal ${MAX_PAUSE_MINUTES} Minuten betragen`); return; }
    try {
      await validateDailyLimit(entryDate, gross, editingEntry.id);
      const { data, error } = await supabase.from("time_entries").update({ work_date: entryDate, started_at: start.toISOString(), ended_at: end.toISOString(), minutes: gross - pause, pause_minutes: pause, notes: notes || null }).eq("id", editingEntry.id).eq("user_id", userId).select();
      if (error) throw error;
      if (!data || data.length === 0) { toast.error("Keine Berechtigung zum Bearbeiten dieses Eintrags"); return; }
      toast.success("Eintrag aktualisiert"); setIsEditDialogOpen(false); setEditingEntry(null); resetEntryForm(); loadData();
    } catch (error: unknown) { debugConsole.error("Update error:", error); toast.error(error instanceof Error ? error.message : "Fehler beim Aktualisieren"); }
  };

  const handleDeleteEntry = async (entryId: string) => {
    setConfirmState({ open: true, title: "Eintrag löschen", description: "Möchten Sie diesen Zeiteintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.", onConfirm: () => performDeleteEntry(entryId) });
  };

  const performDeleteEntry = async (entryId: string) => {
    try {
      const { data, error } = await supabase.from("time_entries").delete().eq("id", entryId).eq("user_id", userId!).select();
      if (error) throw error;
      if (!data || data.length === 0) toast.warning("Eintrag wurde möglicherweise bereits gelöscht");
      else toast.success("Eintrag gelöscht");
      loadData();
    } catch (error: unknown) { debugConsole.error("Delete error:", error); toast.error("Fehler beim Löschen: " + (error instanceof Error ? error.message : String(error))); }
  };

  // Save checklist responses after leave request is created
  const saveChecklistResponses = async (leaveRequestId: string, items: ChecklistItem[]) => {
    if (!userId || items.length === 0) return;
    const rows = items.map(item => ({
      leave_request_id: leaveRequestId,
      checklist_item_id: item.id,
      completed: item.completed,
      completed_at: item.completed ? new Date().toISOString() : null,
      user_id: userId,
    }));
    await supabase.from("vacation_checklist_responses").insert(rows);
  };

  // Leave request handlers
  const handleRequestVacation = async () => {
    if (!userId || !vacationStartDate || !vacationEndDate) { toast.error("Bitte beide Felder ausfüllen"); return; }
    if (!vacationDeputy) { toast.error("Bitte eine Stellvertretung auswählen"); return; }
    if (vacationEndDate < vacationStartDate) { toast.error("Das Enddatum darf nicht vor dem Startdatum liegen"); return; }
    try {
      const { data, error } = await supabase.from("leave_requests").insert([{
        user_id: userId,
        type: "vacation" as const,
        start_date: vacationStartDate,
        end_date: vacationEndDate,
        reason: vacationReason || null,
        status: "pending" as const,
        deputy_user_id: vacationDeputy,
      }]).select("id").single();
      if (error) throw error;

      // Save checklist responses
      if (data?.id && vacationChecklistItems.length > 0) {
        await saveChecklistResponses(data.id, vacationChecklistItems);
      }

      toast.success("Urlaubsantrag eingereicht");
      setVacationStartDate(""); setVacationEndDate(""); setVacationReason("");
      setVacationDeputy(""); setVacationChecklistItems([]);
      loadData();
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : "Fehler"); }
  };

  const handleReportSick = async () => {
    if (!userId || !sickStartDate || !sickEndDate) { toast.error("Bitte beide Felder ausfüllen"); return; }
    if (!sickDeputy) { toast.error("Bitte eine Stellvertretung auswählen"); return; }
    if (sickEndDate < sickStartDate) { toast.error("Das Enddatum darf nicht vor dem Startdatum liegen"); return; }
    try {
      await supabase.from("leave_requests").insert([{
        user_id: userId,
        type: "sick" as const,
        start_date: sickStartDate,
        end_date: sickEndDate,
        reason: sickNotes || null,
        status: "pending" as const,
        deputy_user_id: sickDeputy,
      }]);
      toast.success("Krankmeldung eingereicht");
      setSickStartDate(""); setSickEndDate(""); setSickNotes(""); setSickDeputy("");
      loadData();
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : "Fehler"); }
  };

  const handleReportMedical = async () => {
    if (!userId || !medicalDate || !medicalStartTime || !medicalEndTime) { toast.error("Bitte alle Felder ausfüllen"); return; }
    const [startH, startM] = medicalStartTime.split(":").map(Number);
    const [endH, endM] = medicalEndTime.split(":").map(Number);
    const minutesCounted = (endH * 60 + endM) - (startH * 60 + startM);
    if (minutesCounted <= 0) { toast.error("Endzeit muss nach Startzeit liegen"); return; }
    try {
      const { error } = await supabase.from("leave_requests").insert([{ user_id: userId, type: "medical", start_date: medicalDate, end_date: medicalDate, medical_reason: medicalReason, start_time: medicalStartTime, end_time: medicalEndTime, minutes_counted: minutesCounted, reason: medicalNotes || null, status: "pending" }]).select();
      if (error) throw error;
      toast.success("Arzttermin eingereicht"); setMedicalDate(""); setMedicalStartTime(""); setMedicalEndTime(""); setMedicalReason("acute"); setMedicalNotes(""); loadData();
    } catch (error: unknown) { debugConsole.error("Medical appointment error:", error); toast.error(error instanceof Error ? error.message : "Fehler"); }
  };

  const handleRequestOvertimeReduction = async () => {
    if (!userId || !overtimeStartDate || !overtimeEndDate) { toast.error("Bitte beide Datumsfelder ausfüllen"); return; }
    if (overtimeEndDate < overtimeStartDate) { toast.error("Das Enddatum darf nicht vor dem Startdatum liegen"); return; }
    let days = 0;
    try { days = eachDayOfInterval({ start: parseISO(overtimeStartDate), end: parseISO(overtimeEndDate) }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length; } catch { toast.error("Ungültiger Datumsbereich für den Überstundenabbau"); return; }
    if (days === 0) { toast.error("Bitte mindestens einen Werktag auswählen"); return; }
    try {
      const { error } = await supabase.from("leave_requests").insert([{ user_id: userId, type: "overtime_reduction", start_date: overtimeStartDate, end_date: overtimeEndDate, reason: overtimeReason || null, status: "pending" }]).select();
      if (error) throw error;
      toast.success("Überstundenabbau beantragt"); setOvertimeStartDate(""); setOvertimeEndDate(""); setOvertimeReason(""); loadData();
    } catch (error: unknown) { debugConsole.error("Overtime reduction error:", error); toast.error(error instanceof Error ? error.message : "Fehler"); }
  };

  const removeLeaveCalendarEntry = async (leave: LeaveRow, type: string) => {
    if (!userId) return;
    try {
      const { data: userProfile } = await supabase.from("profiles").select("display_name").eq("user_id", userId).single();
      const userName = userProfile?.display_name || "Mitarbeiter";
      await supabase.from("appointments").delete().eq("category", type).ilike("title", `%${userName}%`).gte("start_time", new Date(leave.start_date).toISOString());
    } catch (error) { debugConsole.error("Error removing calendar entry:", error); }
  };

  const performCancelLeave = async (leaveId: string, leaves: LeaveRow[], type: "vacation" | "medical" | "overtime_reduction", successMsg: string) => {
    try {
      const leave = leaves.find(l => l.id === leaveId);
      if (!leave) { toast.error("Antrag nicht gefunden"); return; }
      const newStatus: Database["public"]["Enums"]["leave_status"] = leave.status === "pending" ? "cancelled" : "cancel_requested";
      const { error } = await supabase.from("leave_requests").update({ status: newStatus }).eq("id", leaveId).eq("user_id", userId!);
      if (error) throw error;
      if (newStatus === "cancelled") await removeLeaveCalendarEntry(leave, type);
      toast.success(newStatus === "cancelled" ? successMsg : "Stornierungsanfrage gesendet");
      loadData();
    } catch (error: unknown) { debugConsole.error(`Error cancelling ${type}:`, error); toast.error("Fehler beim Stornieren"); }
  };

  const handleCancelVacationRequest = (leaveId: string) => {
    setConfirmState({ open: true, title: "Urlaubsantrag stornieren", description: "Möchten Sie diesen Urlaubsantrag wirklich stornieren? Bei genehmigten Anträgen wird eine Stornierungsanfrage an den Admin gesendet.", onConfirm: () => performCancelLeave(leaveId, vacationLeaves, "vacation", "Urlaubsantrag storniert") });
  };

  const handleCancelMedicalRequest = (leaveId: string) => {
    setConfirmState({ open: true, title: "Arzttermin stornieren", description: "Möchten Sie diesen Arzttermin wirklich stornieren?", onConfirm: () => performCancelLeave(leaveId, medicalLeaves, "medical", "Arzttermin storniert") });
  };

  const handleCancelOvertimeRequest = (leaveId: string) => {
    setConfirmState({ open: true, title: "Überstundenabbau stornieren", description: "Möchten Sie diesen Überstundenabbau-Antrag wirklich stornieren?", onConfirm: () => performCancelLeave(leaveId, overtimeLeaves, "overtime_reduction", "Überstundenabbau storniert") });
  };

  return {
    // Entry form
    entryDate, setEntryDate, startTime, setStartTime, endTime, setEndTime,
    pauseMinutes, setPauseMinutes, notes, setNotes,
    editingEntry, isEditDialogOpen, setIsEditDialogOpen,
    onSubmit, handleEditEntry, handleUpdateEntry, handleDeleteEntry,
    // Vacation form
    vacationStartDate, setVacationStartDate, vacationEndDate, setVacationEndDate,
    vacationReason, setVacationReason, handleRequestVacation, handleCancelVacationRequest,
    vacationDeputy, setVacationDeputy,
    vacationChecklistItems, setVacationChecklistItems,
    // Sick form
    sickStartDate, setSickStartDate, sickEndDate, setSickEndDate,
    sickNotes, setSickNotes, handleReportSick,
    sickDeputy, setSickDeputy,
    // Medical form
    medicalDate, setMedicalDate, medicalStartTime, setMedicalStartTime,
    medicalEndTime, setMedicalEndTime, medicalReason, setMedicalReason,
    medicalNotes, setMedicalNotes, handleReportMedical, handleCancelMedicalRequest,
    // Overtime form
    overtimeStartDate, setOvertimeStartDate, overtimeEndDate, setOvertimeEndDate,
    overtimeReason, setOvertimeReason, handleRequestOvertimeReduction, handleCancelOvertimeRequest,
    // Confirm
    confirmState, setConfirmState,
  };
}
