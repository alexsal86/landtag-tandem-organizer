import { useState } from "react";
import { mentionColors } from "@/utils/mentionColors";
import { getHashedColor } from "@/utils/userColors";
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
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { differenceInDays, format } from "date-fns";
import { de } from "date-fns/locale";
import { AlertCircle, History, Check, X, Undo2, Search, MoreHorizontal } from "lucide-react";
import { EmployeeRow, LeaveAgg, PendingLeaveRequest, calculateWorkingDays } from "./types";

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
        <Button variant="ghost" size="sm" className="h-auto gap-1.5 p-0 text-muted-foreground" aria-label="Arbeitszeitverlauf anzeigen"><History className="h-3.5 w-3.5" />Verlauf</Button>
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
                      <div className="font-medium text-sm">{h.hours_per_week.toLocaleString("de-DE")} h/Woche ({percentage}%)</div>
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
                  <TableRow key={req.id} className={isCancelRequest ? "bg-palette-amber/5" : ""}>
                    <TableCell>{req.user_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        req.type === "medical" ? "bg-palette-purple/10 text-palette-purple border-palette-purple/30" :
                        req.type === "overtime_reduction" ? "bg-palette-amber/10 text-palette-amber border-palette-amber/30" :
                        req.type === "sick" ? "bg-palette-orange/10 text-palette-orange border-palette-orange/30" :
                        req.type === "vacation" ? "bg-palette-blue/10 text-palette-blue border-palette-blue/30" : undefined
                      }>
                        {req.type === "vacation" ? "🏖️ Urlaub" : req.type === "sick" ? "🤒 Krank" : req.type === "medical" ? "🏥 Arzttermin" : req.type === "overtime_reduction" ? "⏰ Überstundenabbau" : "Sonstiges"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isCancelRequest ? (
                        <Badge variant="outline" className="bg-palette-amber/10 text-palette-amber border-palette-amber/40"><Undo2 className="h-3 w-3 mr-1" />Stornierung</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-palette-yellow/20 text-palette-yellow">Neu</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(req.start_date).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell>{new Date(req.end_date).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell><Badge variant="secondary">{workingDays} Tage</Badge></TableCell>
                    <TableCell>
                      {isCancelRequest ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-palette-green hover:bg-palette-green/10" onClick={() => onCancelApproval(req.id, true)}>
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
  headerAction?: ReactNode;
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
  loading, employees, leaves, sickDays, setEmployees, headerAction,
  updateHours, updateDaysPerWeek, updateVacationDays, updateStartDate, onScheduleMeeting,
}: EmployeeListTableProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingEmployee = employees.find(employee => employee.user_id === editingId);
  const filteredEmployees = employees.filter(employee =>
    (employee.display_name ?? "Unbenannt").toLocaleLowerCase("de").includes(query.trim().toLocaleLowerCase("de")),
  );

  return (
    <section aria-label="Mitarbeiterliste">
      <Card className="overflow-hidden rounded-2xl shadow-none">
        <CardHeader className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <CardTitle className="text-xl">Mitarbeiterliste</CardTitle>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64 lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Suchen …" aria-label="Mitarbeiter suchen" className="h-11 rounded-xl bg-muted/40 pl-10" />
          </div>
          {headerAction}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6" role="status" aria-label="Mitarbeiter werden geladen"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : employees.length === 0 ? (
            <p className="p-6 text-muted-foreground">Noch keine Mitarbeitenden zugewiesen.</p>
          ) : filteredEmployees.length === 0 ? (
            <p className="p-6 text-muted-foreground" role="status">Keine Mitarbeitenden für „{query}“ gefunden.</p>
          ) : (
            <Table className="min-w-[960px] table-fixed">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[19%] px-6 py-4 text-xs font-semibold uppercase tracking-wide">Mitarbeiter</TableHead>
                  <TableHead className="w-[18%] px-4 py-4 text-xs font-semibold uppercase tracking-wide">Arbeitszeit</TableHead>
                  <TableHead className="w-[19%] px-4 py-4 text-xs font-semibold uppercase tracking-wide">Urlaub</TableHead>
                  <TableHead className="w-[12%] px-4 py-4 text-xs font-semibold uppercase tracking-wide">Krankheit</TableHead>
                  <TableHead className="w-[32%] px-4 py-4 text-xs font-semibold uppercase tracking-wide">Mitarbeitergespräch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => {
                  const e = employee;
                  const a = leaves[e.user_id];
                  const vacApproved = a?.approved.vacation ?? 0;
                  const totalVacation = e.annual_vacation_days + (e.carry_over_days || 0);
                  const remaining = totalVacation - vacApproved;
                  const usedPercent = totalVacation > 0 ? Math.min(100, Math.max(0, vacApproved / totalVacation * 100)) : 0;
                  const daysUntilMeeting = e.next_meeting_due ? differenceInDays(new Date(e.next_meeting_due), new Date()) : null;
                  const name = e.display_name || "Unbenannt";
                  const avatarColor = mentionColors(e.badge_color || getHashedColor(e.user_id));

                  return (
                    <TableRow key={e.user_id}>
                      <TableCell className="px-6 py-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 shrink-0">
                            <AvatarImage src={e.avatar_url ?? undefined} alt={name} />
                            <AvatarFallback className="font-semibold" style={{ backgroundColor: avatarColor.background, color: avatarColor.text }}>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="break-words text-base font-semibold">{name}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{e.employment_start_date ? `Seit ${new Date(e.employment_start_date).toLocaleDateString("de-DE")}` : "Beginn nicht hinterlegt"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-6">
                        <button type="button" onClick={() => setEditingId(e.user_id)} className="text-base underline decoration-muted-foreground/50 decoration-dashed underline-offset-4 hover:text-primary" aria-label={`Arbeitszeit für ${name} bearbeiten`}>
                          {e.hours_per_week.toLocaleString("de-DE")} h / Woche
                        </button>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                          <Badge className="rounded-full border-0 bg-lime-100 text-lime-700 hover:bg-lime-100 dark:bg-lime-950 dark:text-lime-300">{Math.round(e.hours_per_week / 39.5 * 100)} %</Badge>
                          <span>· {e.days_per_week} Tage ·</span>
                          <EmployeeHistoryPopover userId={e.user_id} />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-6">
                        <div className="space-y-2">
                          <p className="text-base"><strong>{vacApproved}</strong> von {totalVacation} Tagen</p>
                          <div role="progressbar" aria-label={`Genutzter Urlaub für ${name}`} aria-valuenow={vacApproved} aria-valuemin={0} aria-valuemax={Math.max(totalVacation, vacApproved, 1)} aria-valuetext={`${vacApproved} von ${totalVacation} Tagen genutzt`} className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-lime-600 transition-all" style={{ width: `${usedPercent}%` }} />
                          </div>
                          <p className="text-sm text-muted-foreground">{remaining} verbleibend</p>
                          {(e.carry_over_days || 0) > 0 && (
                            <TooltipProvider><Tooltip><TooltipTrigger asChild><button type="button" className="flex items-center gap-1 text-xs text-palette-amber">+{e.carry_over_days} Resturlaub<AlertCircle className="h-3 w-3" /></button></TooltipTrigger>
                              <TooltipContent><p>Resturlaub aus {new Date().getFullYear() - 1}</p><p>Verfällt am {e.carry_over_expires_at ? new Date(e.carry_over_expires_at).toLocaleDateString("de-DE") : `31.03.${new Date().getFullYear()}`}</p></TooltipContent>
                            </Tooltip></TooltipProvider>
                          )}
                          {(a?.pending.vacation || 0) > 0 && <Badge variant="outline" className="text-xs text-palette-amber">{a?.pending.vacation} ausstehend</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-6">
                        <Badge variant="secondary" className={`rounded-full border-0 px-3 py-1 ${sickDays[e.user_id] > 0 ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" : "bg-muted text-muted-foreground"}`}>{sickDays[e.user_id] || 0} Tage</Badge>
                        {(a?.pending.sick || 0) > 0 && <div className="mt-2 text-xs text-palette-orange">{a?.pending.sick} ausstehend</div>}
                      </TableCell>
                      <TableCell className="px-4 py-6">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            {daysUntilMeeting !== null ? (
                              <>
                                <Badge className={`rounded-full border-0 ${daysUntilMeeting < 0 ? "bg-pink-100 text-pink-600 hover:bg-pink-100 dark:bg-pink-950 dark:text-pink-300" : "bg-muted text-muted-foreground hover:bg-muted"}`}>
                                  {daysUntilMeeting < 0 ? "Überfällig" : daysUntilMeeting === 0 ? "Heute fällig" : `In ${daysUntilMeeting} Tagen`}
                                </Badge>
                                <p className="text-sm text-muted-foreground">{daysUntilMeeting < 0 ? "Fällig seit" : "Fällig am"} {new Date(e.next_meeting_due!).toLocaleDateString("de-DE")}</p>
                              </>
                            ) : <p className="text-sm text-muted-foreground">Nicht geplant</p>}
                            {e.last_meeting_date && (e.last_meeting_id ? (
                              <button type="button" onClick={() => navigate(`/employee-meeting/${e.last_meeting_id}`)} className="text-left text-sm text-muted-foreground underline-offset-2 hover:underline">Zuletzt {new Date(e.last_meeting_date).toLocaleDateString("de-DE")}</button>
                            ) : <p className="text-sm text-muted-foreground">Zuletzt {new Date(e.last_meeting_date).toLocaleDateString("de-DE")}</p>)}
                            {(e.open_meeting_requests ?? 0) > 0 && <Badge variant="secondary">{e.open_meeting_requests} Anfrage{e.open_meeting_requests! > 1 ? "n" : ""}</Badge>}
                          </div>
                          <div className="flex shrink-0 items-start gap-2">
                            <Button variant="outline" className="h-auto whitespace-normal rounded-xl px-3 py-3" onClick={() => onScheduleMeeting({ id: e.user_id, name })}>Gespräch<br />planen</Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="rounded-xl" aria-label={`Aktionen für ${name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setEditingId(e.user_id)}>Mitarbeiterdaten bearbeiten</DropdownMenuItem></DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!editingEmployee} onOpenChange={open => { if (!open) setEditingId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mitarbeiterdaten bearbeiten</DialogTitle><DialogDescription>{editingEmployee?.display_name || "Unbenannt"} · Änderungen werden automatisch gespeichert.</DialogDescription></DialogHeader>
          {editingEmployee && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="employee-hours">Stunden pro Woche</Label><Input id="employee-hours" type="number" min={1} max={39.5} step={0.5} value={editingEmployee.hours_per_week} onChange={event => {
                const v = Number(event.target.value); if (v >= 1 && v <= 39.5) { setEmployees(prev => prev.map(e => e.user_id === editingId ? { ...e, hours_per_week: v } : e)); updateHours(editingEmployee.user_id, v); }
              }} /></div>
              <div className="space-y-2"><Label htmlFor="employee-days">Tage pro Woche</Label><Input id="employee-days" type="number" min={1} max={5} value={editingEmployee.days_per_week} onChange={event => {
                const v = Number(event.target.value); if (v >= 1 && v <= 5) { setEmployees(prev => prev.map(e => e.user_id === editingId ? { ...e, days_per_week: v } : e)); updateDaysPerWeek(editingEmployee.user_id, v); }
              }} /></div>
              <div className="space-y-2"><Label htmlFor="employee-vacation">Urlaubstage pro Jahr</Label><Input id="employee-vacation" type="number" min={0} max={50} value={editingEmployee.annual_vacation_days} onChange={event => {
                const v = Number(event.target.value); if (v >= 0 && v <= 50) { setEmployees(prev => prev.map(e => e.user_id === editingId ? { ...e, annual_vacation_days: v } : e)); updateVacationDays(editingEmployee.user_id, v); }
              }} /></div>
              <div className="space-y-2"><Label htmlFor="employee-start">Beginn Arbeitsverhältnis</Label><Input id="employee-start" type="date" value={editingEmployee.employment_start_date || ""} onChange={event => {
                const v = event.target.value; if (v) { setEmployees(prev => prev.map(e => e.user_id === editingId ? { ...e, employment_start_date: v } : e)); updateStartDate(editingEmployee.user_id, v); }
              }} /></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
