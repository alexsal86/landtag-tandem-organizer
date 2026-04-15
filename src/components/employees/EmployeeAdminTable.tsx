import { useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { debugConsole } from '@/utils/debugConsole';
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow, differenceInDays, format } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, AlertCircle, History, Check, X, Undo2 } from "lucide-react";
import { EmployeeRow, LeaveAgg, PendingLeaveRequest, calculateWorkingDays } from "./types";

type ColumnDef<TData> = {
  id: string;
  header: ReactNode;
  cell: (row: TData) => ReactNode;
};

// --- EmployeeHistoryPopover ---
function EmployeeHistoryPopover({ userId }: { userId: string }) {
  type EmployeeHistoryRow = {
    id: string;
    hours_per_week: number;
    valid_from: string;
    valid_until: string | null;
    change_reason: string | null;
  };

  const [history, setHistory] = useState<EmployeeHistoryRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    if (loading || history.length > 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('employee_settings_history').select('id, user_id, hours_per_week, valid_from, valid_until, change_reason, created_at').eq('user_id', userId).order('valid_from', { ascending: false });
      if (error) throw error;
      setHistory(data || []);
    } catch (error) { debugConsole.error('Error loading history:', error); } finally { setLoading(false); }
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (open && history.length === 0) loadHistory(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><History className="h-3.5 w-3.5" /></Button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Änderungshistorie</h4>
          {loading ? <p className="text-xs text-muted-foreground">Lade Historie...</p> : history.length === 0 ? <p className="text-xs text-muted-foreground">Keine Änderungen vorhanden</p> : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {history.map(h => {
                const percentage = Math.round((h.hours_per_week / 39.5) * 100);
                const isCurrent = !h.valid_until;
                return (
                  <div key={h.id} className={`flex justify-between items-start border-b pb-2 ${isCurrent ? 'bg-accent/30 -mx-2 px-2 rounded' : ''}`}>
                    <div className="space-y-0.5">
                      <div className="font-medium text-sm">{h.hours_per_week}h/Woche ({percentage}%)</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(h.valid_from), "dd.MM.yyyy", { locale: de })} - {h.valid_until ? format(new Date(h.valid_until), "dd.MM.yyyy", { locale: de }) : "heute"}
                      </div>
                      {h.change_reason && <div className="text-xs text-muted-foreground italic">{h.change_reason}</div>}
                    </div>
                    <Badge variant={isCurrent ? "default" : "secondary"} className="text-xs">{isCurrent ? "Aktuell" : "Alt"}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// --- Pending Leaves Table ---
interface PendingLeavesTableProps {
  pendingLeaves: PendingLeaveRequest[];
  onLeaveAction: (id: string, action: "approved" | "rejected") => void;
  onCancelApproval: (id: string, approve: boolean) => void;
}

export function PendingLeavesTable({ pendingLeaves, onLeaveAction, onCancelApproval }: PendingLeavesTableProps) {
  if (pendingLeaves.length === 0) return null;

  return (
    <section>
      <Card>
        <CardHeader><CardTitle>Offene Urlaubsanträge ({pendingLeaves.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mitarbeiter</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Von</TableHead>
                <TableHead>Bis</TableHead>
                <TableHead>Arbeitstage</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingLeaves.map((req) => {
                const workingDays = calculateWorkingDays(req.start_date, req.end_date);
                const isCancelRequest = req.status === 'cancel_requested';
                return (
                  <TableRow key={req.id} className={isCancelRequest ? "bg-amber-50/50" : ""}>
                    <TableCell>{req.user_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        req.type === "medical" ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-800" :
                        req.type === "overtime_reduction" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800" :
                        req.type === "sick" ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-800" :
                        req.type === "vacation" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-800" : undefined
                      }>
                        {req.type === "vacation" ? "🏖️ Urlaub" : req.type === "sick" ? "🤒 Krank" : req.type === "medical" ? "🏥 Arzttermin" : req.type === "overtime_reduction" ? "⏰ Überstundenabbau" : "Sonstiges"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isCancelRequest ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300"><Undo2 className="h-3 w-3 mr-1" />Stornierung</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Neu</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(req.start_date).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell>{new Date(req.end_date).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell><Badge variant="secondary">{workingDays} Tage</Badge></TableCell>
                    <TableCell>
                      {isCancelRequest ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-green-700 hover:bg-green-50" onClick={() => onCancelApproval(req.id, true)}>
                            <Check className="h-4 w-4 mr-1" />Stornierung genehmigen
                          </Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onCancelApproval(req.id, false)}>
                            <X className="h-4 w-4 mr-1" />Ablehnen
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" variant="default" onClick={() => onLeaveAction(req.id, "approved")}>Genehmigen</Button>
                          <Button size="sm" variant="destructive" onClick={() => onLeaveAction(req.id, "rejected")}>Ablehnen</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

// --- Employee List Table ---
interface EmployeeListTableProps {
  loading: boolean;
  employees: EmployeeRow[];
  leaves: Record<string, LeaveAgg>;
  sickDays: Record<string, number>;
  setEmployees: Dispatch<SetStateAction<EmployeeRow[]>>;
  updateHours: (userId: string, val: number) => Promise<unknown> | void;
  updateDaysPerWeek: (userId: string, val: number) => Promise<unknown> | void;
  updateVacationDays: (userId: string, val: number) => Promise<unknown> | void;
  updateStartDate: (userId: string, val: string) => Promise<unknown> | void;
  onScheduleMeeting: (employee: { id: string; name: string }) => Promise<unknown> | void;
}

export function EmployeeListTable({
  loading, employees, leaves, sickDays, setEmployees,
  updateHours, updateDaysPerWeek, updateVacationDays, updateStartDate, onScheduleMeeting,
}: EmployeeListTableProps) {
  const navigate = useNavigate();
  const employeeColumns: Array<ColumnDef<EmployeeRow>> = [
    { id: "employee", header: "Mitarbeiter", cell: () => null },
    { id: "hours_per_week", header: <div className="flex flex-col"><span>Stunden/Woche</span><span className="text-xs text-muted-foreground font-normal">(max. 39,5h)</span></div>, cell: () => null },
    { id: "days_per_week", header: <div className="flex flex-col"><span>Tage/Woche</span><span className="text-xs text-muted-foreground font-normal">(max. 5)</span></div>, cell: () => null },
    { id: "annual_vacation_days", header: "Urlaubstage/Jahr", cell: () => null },
    { id: "employment_start_date", header: "Beginn Arbeitsverhältnis", cell: () => null },
    { id: "sick_days", header: "Krankentage", cell: () => null },
    { id: "vacation", header: "Urlaub", cell: () => null },
    { id: "last_meeting", header: "Letztes Gespräch", cell: () => null },
    { id: "next_meeting", header: "Nächstes Gespräch", cell: () => null },
    { id: "action", header: "Aktion", cell: () => null },
  ];

  return (
    <section>
      <Card>
        <CardHeader><CardTitle>Mitarbeiterliste</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : employees.length === 0 ? (
            <p className="text-muted-foreground">Noch keine Mitarbeitenden zugewiesen.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {employeeColumns.map((column) => (
                    <TableHead key={column.id}>{column.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => {
                  const a = leaves[e.user_id];
                  const vacApproved = a?.approved.vacation ?? 0;
                  const remainingVacationDays = e.annual_vacation_days - vacApproved;

                  return (
                    <TableRow key={e.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={e.avatar_url ?? undefined} alt={e.display_name ?? "Avatar"} />
                            <AvatarFallback>{(e.display_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{e.display_name ?? "Unbenannt"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input type="number" step="0.5" value={e.hours_per_week}
                            onChange={(ev) => { const v = Number(ev.target.value); if (v >= 1 && v <= 39.5) { setEmployees(prev => prev.map(emp => emp.user_id === e.user_id ? { ...emp, hours_per_week: v } : emp)); updateHours(e.user_id, v); } }}
                            className="w-24 h-10 rounded-lg border-slate-200 bg-slate-50/80 font-medium" min="1" max="39.5" />
                          <Badge variant="outline" className="text-xs whitespace-nowrap">{Math.round((e.hours_per_week / 39.5) * 100)}%</Badge>
                          <EmployeeHistoryPopover userId={e.user_id} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={e.days_per_week}
                          onChange={(ev) => { const v = Number(ev.target.value); if (v >= 1 && v <= 5) { setEmployees(prev => prev.map(emp => emp.user_id === e.user_id ? { ...emp, days_per_week: v } : emp)); updateDaysPerWeek(e.user_id, v); } }}
                          className="w-24 h-10 rounded-lg border-slate-200 bg-slate-50/80 font-medium" min="1" max="5" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={e.annual_vacation_days}
                          onChange={(ev) => { const v = Number(ev.target.value); if (v >= 0 && v <= 50) { setEmployees(prev => prev.map(emp => emp.user_id === e.user_id ? { ...emp, annual_vacation_days: v } : emp)); updateVacationDays(e.user_id, v); } }}
                          className="w-24 h-10 rounded-lg border-slate-200 bg-slate-50/80 font-medium" min="0" max="50" />
                      </TableCell>
                      <TableCell>
                        <Input type="date" value={e.employment_start_date || "2025-01-01"}
                          onChange={(ev) => { const v = ev.target.value; setEmployees(prev => prev.map(emp => emp.user_id === e.user_id ? { ...emp, employment_start_date: v } : emp)); updateStartDate(e.user_id, v); }}
                          className="w-44 h-10 rounded-lg border-slate-200 bg-slate-50/80 font-medium" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{sickDays[e.user_id] || 0} Tage</Badge>
                          {(a?.pending?.sick || 0) > 0 && <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">⏳ {a?.pending.sick}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="secondary">{vacApproved} von {e.annual_vacation_days + (e.carry_over_days || 0)} Tagen</Badge>
                          {(e.carry_over_days || 0) > 0 && (
                            <div className="text-xs text-amber-600 flex items-center gap-1">
                              <span>+{e.carry_over_days} Resturlaub</span>
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><AlertCircle className="h-3 w-3 cursor-help" /></TooltipTrigger>
                                <TooltipContent><p>Resturlaub aus {new Date().getFullYear() - 1}</p><p className="text-xs text-muted-foreground">Verfällt am 31.03.{new Date().getFullYear()}</p></TooltipContent>
                              </Tooltip></TooltipProvider>
                            </div>
                          )}
                          {remainingVacationDays + (e.carry_over_days || 0) > 0 && (
                            <div className="text-xs text-muted-foreground">{remainingVacationDays + (e.carry_over_days || 0)} verbleibend</div>
                          )}
                          {(a?.pending?.vacation || 0) > 0 && <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">⏳ {a?.pending.vacation} ausstehend</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {e.last_meeting_date && e.last_meeting_id ? (
                          <Button variant="ghost" className="h-auto p-2 hover:bg-muted" onClick={() => navigate(`/employee-meeting/${e.last_meeting_id}`)}>
                            <div className="space-y-1 text-left">
                              <div className="text-sm">{new Date(e.last_meeting_date).toLocaleDateString('de-DE')}</div>
                              <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.last_meeting_date), { addSuffix: true, locale: de })}</div>
                            </div>
                          </Button>
                        ) : e.last_meeting_date ? (
                          <div className="space-y-1">
                            <div className="text-sm">{new Date(e.last_meeting_date).toLocaleDateString('de-DE')}</div>
                            <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.last_meeting_date), { addSuffix: true, locale: de })}</div>
                          </div>
                        ) : <span className="text-muted-foreground text-sm">–</span>}
                      </TableCell>
                      <TableCell>
                        {e.next_meeting_due ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2"><Calendar className="h-3 w-3" /><span className="text-sm">{new Date(e.next_meeting_due).toLocaleDateString('de-DE')}</span></div>
                            {differenceInDays(new Date(e.next_meeting_due), new Date()) < 0 ? (
                              <Badge variant="destructive" className="text-xs"><AlertCircle className="h-3 w-3 mr-1" />Überfällig</Badge>
                            ) : differenceInDays(new Date(e.next_meeting_due), new Date()) <= 14 ? (
                              <Badge variant="default" className="text-xs">In {differenceInDays(new Date(e.next_meeting_due), new Date())} Tagen</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">In {differenceInDays(new Date(e.next_meeting_due), new Date())} Tagen</span>
                            )}
                            {(e.open_meeting_requests ?? 0) > 0 && <Badge variant="secondary" className="text-xs">{e.open_meeting_requests} Anfrage{(e.open_meeting_requests ?? 0) > 1 ? 'n' : ''}</Badge>}
                          </div>
                        ) : <span className="text-muted-foreground text-sm">Nicht geplant</span>}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => onScheduleMeeting({ id: e.user_id, name: e.display_name || "Unbenannt" })}>Gespräch planen</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
