import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Employee, PendingLeaveRequest, LeaveType, calculateWorkingDays } from "../types";

interface UseEmployeeOperationsProps {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  pendingLeaves: PendingLeaveRequest[];
  setPendingLeaves: React.Dispatch<React.SetStateAction<PendingLeaveRequest[]>>;
}

export function useEmployeeOperations({
  employees, setEmployees, pendingLeaves, setPendingLeaves,
}: UseEmployeeOperationsProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const createLeaveCalendarEntry = async (leaveRequest: PendingLeaveRequest, userId: string, leaveType: LeaveType) => {
    try {
      const { data: userProfile } = await supabase.from("profiles").select("display_name").eq("user_id", userId).single();
      const { data: tenantData } = await supabase.from("user_tenant_memberships").select("tenant_id").eq("user_id", user?.id).eq("is_active", true).limit(1).single();
      if (!tenantData) return;

      const userName = userProfile?.display_name || "Mitarbeiter";
      const workingDays = calculateWorkingDays(leaveRequest.start_date, leaveRequest.end_date);

      const config: Record<LeaveType, { title: string; description: string; category: string; requestTitle: string; requestCategory: string }> = {
        vacation: { title: `Urlaub von ${userName}`, description: `Urlaubsantrag genehmigt (${workingDays} Arbeitstage)`, category: 'vacation', requestTitle: `Anfrage Urlaub von ${userName}`, requestCategory: 'vacation_request' },
        sick: { title: `Krankheit: ${userName}`, description: `Krankmeldung (${workingDays} Arbeitstage)`, category: 'sick', requestTitle: `Anfrage Krankheit: ${userName}`, requestCategory: 'sick_request' },
        medical: { title: `Arzttermin: ${userName}`, description: `Arzttermin genehmigt`, category: 'medical', requestTitle: `Anfrage Arzttermin: ${userName}`, requestCategory: 'medical_request' },
        overtime_reduction: { title: `Überstundenabbau: ${userName}`, description: `Überstundenabbau genehmigt (${workingDays} Arbeitstage)`, category: 'overtime_reduction', requestTitle: `Anfrage Überstundenabbau: ${userName}`, requestCategory: 'overtime_request' },
        other: { title: `Abwesenheit: ${userName}`, description: `Abwesenheit (${workingDays} Arbeitstage)`, category: 'other', requestTitle: `Anfrage: ${userName}`, requestCategory: 'other_request' },
      };

      const typeConfig = config[leaveType];
      const { data: existingEntry } = await supabase.from("appointments").select("id")
        .eq("title", typeConfig.requestTitle).eq("start_time", new Date(leaveRequest.start_date).toISOString()).eq("category", typeConfig.requestCategory).single();

      if (existingEntry) {
        await supabase.from("appointments").update({ title: typeConfig.title, description: typeConfig.description, category: typeConfig.category, status: "confirmed" }).eq("id", existingEntry.id);
      } else {
        await supabase.from("appointments").insert({
          user_id: user?.id, tenant_id: tenantData.tenant_id,
          start_time: new Date(leaveRequest.start_date).toISOString(),
          end_time: new Date(leaveRequest.end_date + "T23:59:59").toISOString(),
          title: typeConfig.title, description: typeConfig.description, category: typeConfig.category,
          priority: "medium", status: "confirmed", is_all_day: true,
        });
      }
    } catch (error) {
      debugConsole.error("Fehler beim Erstellen des Kalendereintrags:", error);
    }
  };

  const handleLeaveAction = async (leaveId: string, action: "approved" | "rejected") => {
    const leaveRequest = pendingLeaves.find(req => req.id === leaveId);
    const previousLeaves = [...pendingLeaves];
    setPendingLeaves(prev => prev.filter(l => l.id !== leaveId));

    try {
      const { error } = await supabase.from("leave_requests").update({ status: action }).eq("id", leaveId);
      if (error) throw error;

      if (leaveRequest) {
        const { data: userProfile } = await supabase.from("profiles").select("display_name").eq("user_id", leaveRequest.user_id).single();
        const userName = userProfile?.display_name || "Mitarbeiter";

        if (action === "approved") {
          await createLeaveCalendarEntry(leaveRequest, leaveRequest.user_id, leaveRequest.type);
        } else {
          const categoryMap: Record<LeaveType, string> = { vacation: 'vacation_request', sick: 'sick_request', medical: 'medical_request', overtime_reduction: 'overtime_request', other: 'other_request' };
          await supabase.from("appointments").delete().ilike("title", `%${userName}%`).eq("start_time", new Date(leaveRequest.start_date).toISOString()).eq("category", categoryMap[leaveRequest.type]);
        }
      }

      const typeLabel = leaveRequest?.type === "medical" ? "Arzttermin" : leaveRequest?.type === "overtime_reduction" ? "Überstundenabbau" : leaveRequest?.type === "vacation" ? "Urlaubsantrag" : "Antrag";
      toast({ title: action === "approved" ? `${typeLabel} genehmigt` : `${typeLabel} abgelehnt`, description: action === "approved" ? `Der ${typeLabel} wurde genehmigt.` : `Der ${typeLabel} wurde abgelehnt.` });
      setTimeout(() => window.location.reload(), 300);
    } catch (e: any) {
      debugConsole.error(e);
      if (e?.message?.includes('Failed to fetch') || e?.message?.includes('NetworkError') || e?.name === 'TypeError') {
        await new Promise(r => setTimeout(r, 500));
        const { data: checkData } = await supabase.from("leave_requests").select("status").eq("id", leaveId).maybeSingle();
        if (checkData?.status === action) {
          toast({ title: action === "approved" ? "Antrag genehmigt" : "Antrag abgelehnt", description: "Die Aktion wurde erfolgreich durchgeführt." });
          setTimeout(() => window.location.reload(), 300);
          return;
        }
      }
      setPendingLeaves(previousLeaves);
      toast({ title: "Fehler", description: e?.message ?? "Antrag konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const handleCancelApproval = async (leaveId: string, approve: boolean) => {
    try {
      const leaveRequest = pendingLeaves.find(req => req.id === leaveId);
      const newStatus: Database["public"]["Enums"]["leave_status"] = approve ? 'cancelled' : 'approved';
      const { error } = await supabase.from("leave_requests").update({ status: newStatus }).eq("id", leaveId);
      if (error) throw error;

      if (approve && leaveRequest) {
        const { data: userProfile } = await supabase.from("profiles").select("display_name").eq("user_id", leaveRequest.user_id).single();
        const userName = userProfile?.display_name || "Mitarbeiter";
        const categoryMap: Record<LeaveType, string> = { vacation: 'vacation', sick: 'sick', medical: 'medical', overtime_reduction: 'overtime_reduction', other: 'other' };
        await supabase.from("appointments").delete().ilike("title", `%${userName}%`).eq("category", categoryMap[leaveRequest.type]).gte("start_time", new Date(leaveRequest.start_date).toISOString());
      }

      toast({ title: approve ? "Stornierung genehmigt" : "Stornierung abgelehnt", description: approve ? "Die Urlaubsstornierung wurde genehmigt und der Kalendereintrag entfernt." : "Die Stornierung wurde abgelehnt. Der Urlaub bleibt bestehen." });
      window.location.reload();
    } catch (e: any) {
      debugConsole.error(e);
      toast({ title: "Fehler", description: e?.message ?? "Stornierungsanfrage konnte nicht verarbeitet werden.", variant: "destructive" });
    }
  };

  const updateHours = async (userId: string, newHours: number) => {
    if (newHours < 1 || newHours > 39.5) { toast({ title: "Ungültige Eingabe", description: "Stunden müssen zwischen 1 und 39,5 liegen.", variant: "destructive" }); return; }
    try {
      const { data, error } = await supabase.from("employee_settings").upsert({ user_id: userId, hours_per_week: newHours, admin_id: user?.id }, { onConflict: 'user_id', ignoreDuplicates: false }).select();
      if (error) throw error;
      setEmployees(prev => prev.map(emp => emp.user_id === userId ? { ...emp, hours_per_week: newHours } : emp));
      toast({ title: "Gespeichert", description: "Stunden pro Woche wurden aktualisiert." });
    } catch (e: any) {
      debugConsole.error(e);
      toast({ title: "Fehler", description: e?.message ?? "Stunden konnten nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const updateDaysPerWeek = async (userId: string, newDays: number) => {
    if (newDays < 1 || newDays > 5) { toast({ title: "Ungültige Eingabe", description: "Tage müssen zwischen 1 und 5 liegen.", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.from("employee_settings").upsert({ user_id: userId, days_per_week: newDays, admin_id: user?.id }, { onConflict: 'user_id', ignoreDuplicates: false });
      if (error) throw error;
      setEmployees(prev => prev.map(emp => emp.user_id === userId ? { ...emp, days_per_week: newDays } : emp));
      toast({ title: "Gespeichert", description: "Tage pro Woche wurden aktualisiert." });
    } catch (e: any) {
      debugConsole.error(e); toast({ title: "Fehler", description: e?.message ?? "Tage konnten nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const updateDaysPerMonth = async (userId: string, newDays: number) => {
    if (newDays < 1 || newDays > 31) { toast({ title: "Ungültige Eingabe", description: "Tage müssen zwischen 1 und 31 liegen.", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.from("employee_settings").upsert({ user_id: userId, days_per_month: newDays, admin_id: user?.id }, { onConflict: 'user_id', ignoreDuplicates: false });
      if (error) throw error;
      setEmployees(prev => prev.map(emp => emp.user_id === userId ? { ...emp, days_per_month: newDays } : emp));
      toast({ title: "Gespeichert", description: "Tage pro Monat wurden aktualisiert." });
    } catch (e: any) {
      debugConsole.error(e); toast({ title: "Fehler", description: e?.message ?? "Tage konnten nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const updateVacationDays = async (userId: string, newDays: number) => {
    if (newDays < 0 || newDays > 50) { toast({ title: "Ungültige Eingabe", description: "Urlaubstage müssen zwischen 0 und 50 liegen.", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.from("employee_settings").upsert({ user_id: userId, annual_vacation_days: newDays, admin_id: user?.id }, { onConflict: 'user_id', ignoreDuplicates: false });
      if (error) throw error;
      setEmployees(prev => prev.map(emp => emp.user_id === userId ? { ...emp, annual_vacation_days: newDays } : emp));
      toast({ title: "Gespeichert", description: "Urlaubstage wurden aktualisiert." });
    } catch (e: any) {
      debugConsole.error(e); toast({ title: "Fehler", description: e?.message ?? "Urlaubstage konnten nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const updateStartDate = async (userId: string, newDate: string) => {
    try {
      const { error } = await supabase.from("employee_settings").upsert({ user_id: userId, employment_start_date: newDate, admin_id: user?.id }, { onConflict: 'user_id', ignoreDuplicates: false });
      if (error) throw error;
      setEmployees(prev => prev.map(emp => emp.user_id === userId ? { ...emp, employment_start_date: newDate } : emp));
      toast({ title: "Gespeichert", description: "Startdatum wurde aktualisiert." });
    } catch (e: any) {
      console.error(e); toast({ title: "Fehler", description: e?.message ?? "Startdatum konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  return {
    handleLeaveAction, handleCancelApproval,
    updateHours, updateDaysPerWeek, updateDaysPerMonth, updateVacationDays, updateStartDate,
  };
}
