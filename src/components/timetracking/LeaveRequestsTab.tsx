import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { VacationHistoryDialog } from "@/features/timetracking/components/VacationHistoryDialog";
import { DeputySelect } from "./DeputySelect";
import { VacationChecklistForm, useVacationChecklistItems } from "./VacationChecklistForm";
import type { ChecklistItem } from "./VacationChecklistForm";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { AlertTriangle, Clock, History, Stethoscope, Timer, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { LeaveRow, EmployeeSettingsRow } from "./types";
import { fmt, getMedicalReasonLabel } from "./types";

const getStatusBadge = (status: string) => {
  const config = {
    approved: { label: "✓ Genehmigt", className: "bg-green-100 text-green-800 border-green-200" },
    pending: { label: "⏳ Ausstehend", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    rejected: { label: "✗ Abgelehnt", className: "bg-red-100 text-red-800 border-red-200" },
    cancel_requested: { label: "↩ Stornierung angefragt", className: "bg-amber-50 text-amber-700 border-amber-300" },
    cancelled: { label: "✗ Storniert", className: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  const { label, className } = config[status as keyof typeof config] || config.pending;
  return <Badge className={className}>{label}</Badge>;
};

interface LeaveRequestsTabProps {
  selectedMonth: Date;
  pendingLeaves: LeaveRow[];
  vacationLeaves: LeaveRow[];
  sickLeaves: LeaveRow[];
  medicalLeaves: LeaveRow[];
  overtimeLeaves: LeaveRow[];
  employeeSettings: EmployeeSettingsRow;
  vacationBalance: any;
  yearlyBalance: number;
  // Vacation form
  vacationStartDate: string; setVacationStartDate: (v: string) => void;
  vacationEndDate: string; setVacationEndDate: (v: string) => void;
  vacationReason: string; setVacationReason: (v: string) => void;
  handleRequestVacation: () => void;
  handleCancelVacationRequest: (id: string) => void;
  vacationDeputy: string; setVacationDeputy: (v: string) => void;
  vacationChecklistItems: ChecklistItem[]; setVacationChecklistItems: (items: ChecklistItem[]) => void;
  // Sick form
  sickStartDate: string; setSickStartDate: (v: string) => void;
  sickEndDate: string; setSickEndDate: (v: string) => void;
  sickNotes: string; setSickNotes: (v: string) => void;
  handleReportSick: () => void;
  sickDeputy: string; setSickDeputy: (v: string) => void;
  // Medical form
  medicalDate: string; setMedicalDate: (v: string) => void;
  medicalStartTime: string; setMedicalStartTime: (v: string) => void;
  medicalEndTime: string; setMedicalEndTime: (v: string) => void;
  medicalReason: string; setMedicalReason: (v: string) => void;
  medicalNotes: string; setMedicalNotes: (v: string) => void;
  handleReportMedical: () => void;
  handleCancelMedicalRequest: (id: string) => void;
  // Overtime form
  overtimeStartDate: string; setOvertimeStartDate: (v: string) => void;
  overtimeEndDate: string; setOvertimeEndDate: (v: string) => void;
  overtimeReason: string; setOvertimeReason: (v: string) => void;
  handleRequestOvertimeReduction: () => void;
  handleCancelOvertimeRequest: (id: string) => void;
}

export function LeaveRequestsTab(props: LeaveRequestsTabProps) {
  const [vacationHistoryOpen, setVacationHistoryOpen] = useState(false);
  const year = props.selectedMonth.getFullYear();

  // Load checklist items from DB
  const { items: checklistTemplates, loading: checklistLoading } = useVacationChecklistItems();

  // Sync checklist items when templates load
  useEffect(() => {
    if (checklistTemplates.length > 0 && props.vacationChecklistItems.length === 0) {
      props.setVacationChecklistItems(checklistTemplates);
    }
  }, [checklistTemplates]);

  return (
    <div className="space-y-6">
      {/* Pending Requests Alert */}
      {props.pendingLeaves.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-800">
              <Clock className="h-4 w-4" />
              Ausstehende Anträge ({props.pendingLeaves.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {props.pendingLeaves.map(p => (
                <li key={p.id} className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                    {p.type === "vacation" ? "🏖️ Urlaub" : p.type === "sick" ? "🤒 Krankheit" : p.type === "medical" ? "🏥 Arzttermin" : p.type === "overtime_reduction" ? "⏰ Überstundenabbau" : "📋 Sonstiges"}
                  </Badge>
                  <span>{format(parseISO(p.start_date), "dd.MM.yyyy")} - {format(parseISO(p.end_date), "dd.MM.yyyy")}</span>
                  <span className="text-muted-foreground">• Warten auf Genehmigung</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Vacation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Urlaub beantragen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Von</Label><Input type="date" value={props.vacationStartDate} onChange={e => props.setVacationStartDate(e.target.value)} /></div>
              <div><Label>Bis</Label><Input type="date" value={props.vacationEndDate} onChange={e => props.setVacationEndDate(e.target.value)} /></div>
            </div>
            <DeputySelect value={props.vacationDeputy} onChange={props.setVacationDeputy} required />
            <div><Label>Grund</Label><Textarea value={props.vacationReason} onChange={e => props.setVacationReason(e.target.value)} placeholder="Optional" /></div>
            {!checklistLoading && (
              <VacationChecklistForm
                items={props.vacationChecklistItems}
                onItemsChange={props.setVacationChecklistItems}
              />
            )}
            <Button onClick={props.handleRequestVacation}>Urlaub beantragen</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Urlaubskonto {year}</CardTitle>
                <CardDescription className="mt-1">
                  Anspruch: {props.vacationBalance.totalEntitlement} | Genommen: {props.vacationBalance.taken} | Verbleibend: {props.vacationBalance.remaining}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setVacationHistoryOpen(true)}>
                <History className="h-4 w-4 mr-1" />Historie
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {props.vacationBalance.carryOver > 0 && !props.vacationBalance.carryOverExpired && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-amber-800">Resturlaub aus {year - 1}</span>
                  </div>
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                    {props.vacationBalance.carryOverRemaining} von {props.vacationBalance.carryOver} Tagen übrig
                  </Badge>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  ⚠️ Verfällt am {props.employeeSettings?.carry_over_expires_at ? format(new Date(props.employeeSettings.carry_over_expires_at), "dd.MM.yyyy") : `31.03.${year}`} – Wird zuerst verbraucht!
                </p>
              </div>
            )}
            {props.vacationBalance.carryOverExpired && (
              <div className="p-3 rounded-lg border border-red-200 bg-red-50">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-800">Resturlaub aus dem Vorjahr ist am 31.03. verfallen.</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-muted-foreground">Neuer Urlaub {year}</div>
                <div className="font-semibold text-lg">{props.vacationBalance.newVacationRemaining} / {props.vacationBalance.prorated} Tage</div>
              </div>
              {props.vacationBalance.carryOver > 0 && !props.vacationBalance.carryOverExpired && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-amber-700">Resturlaub</div>
                  <div className="font-semibold text-lg text-amber-800">{props.vacationBalance.carryOverRemaining} / {props.vacationBalance.carryOver} Tage</div>
                </div>
              )}
            </div>
            {props.vacationLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Urlaubsanträge vorhanden</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Von</TableHead><TableHead>Bis</TableHead><TableHead>Tage</TableHead><TableHead>Grund</TableHead><TableHead>Status</TableHead><TableHead>Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.vacationLeaves.map(v => {
                    const d = eachDayOfInterval({ start: parseISO(v.start_date), end: parseISO(v.end_date) }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
                    const canCancel = (v.status === "pending" || v.status === "approved") && parseISO(v.start_date) > new Date();
                    const isCancelRequested = v.status === "cancel_requested";
                    return (
                      <TableRow key={v.id}>
                        <TableCell>{format(parseISO(v.start_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>{format(parseISO(v.end_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>{d}</TableCell>
                        <TableCell>{v.reason || "-"}</TableCell>
                        <TableCell>{getStatusBadge(v.status)}</TableCell>
                        <TableCell>
                          {canCancel && !isCancelRequested && (
                            <Button variant="ghost" size="sm" onClick={() => props.handleCancelVacationRequest(v.id)} className="h-8 px-2 text-muted-foreground hover:text-destructive">
                              <Undo2 className="h-4 w-4 mr-1" />Stornieren
                            </Button>
                          )}
                          {isCancelRequested && <span className="text-xs text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3" />Wird geprüft</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sick */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Krankmeldung</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Von</Label><Input type="date" value={props.sickStartDate} onChange={e => props.setSickStartDate(e.target.value)} /></div>
              <div><Label>Bis</Label><Input type="date" value={props.sickEndDate} onChange={e => props.setSickEndDate(e.target.value)} /></div>
            </div>
            <DeputySelect value={props.sickDeputy} onChange={props.setSickDeputy} required />
            <div><Label>Notizen</Label><Textarea value={props.sickNotes} onChange={e => props.setSickNotes(e.target.value)} placeholder="Optional" /></div>
            <Button onClick={props.handleReportSick}>Krankmeldung einreichen</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Krankmeldungen {year}</CardTitle></CardHeader>
          <CardContent>
            {props.sickLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Krankmeldungen vorhanden</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Von</TableHead><TableHead>Bis</TableHead><TableHead>Tage</TableHead><TableHead>Notizen</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {props.sickLeaves.map(s => {
                    const d = eachDayOfInterval({ start: parseISO(s.start_date), end: parseISO(s.end_date) }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>{format(parseISO(s.start_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>{format(parseISO(s.end_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>{d}</TableCell>
                        <TableCell>{s.reason || "-"}</TableCell>
                        <TableCell>{getStatusBadge(s.status)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Medical */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-purple-600" />Arzttermin melden</CardTitle>
            <CardDescription>Bezahlte Freistellung für akute Arztbesuche, Facharzttermine oder Nachsorge</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Datum</Label><Input type="date" value={props.medicalDate} onChange={e => props.setMedicalDate(e.target.value)} /></div>
              <div><Label>Von</Label><Input type="time" value={props.medicalStartTime} onChange={e => props.setMedicalStartTime(e.target.value)} /></div>
              <div><Label>Bis</Label><Input type="time" value={props.medicalEndTime} onChange={e => props.setMedicalEndTime(e.target.value)} /></div>
            </div>
            <div>
              <Label>Art des Termins</Label>
              <Select value={props.medicalReason} onValueChange={props.setMedicalReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="acute">Akuter Arztbesuch (plötzliche Beschwerden)</SelectItem>
                  <SelectItem value="specialist">Unaufschiebbarer Facharzttermin</SelectItem>
                  <SelectItem value="follow_up">Nachsorge nach OP</SelectItem>
                  <SelectItem value="pregnancy">Schwangerschaftsvorsorge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notizen</Label><Textarea value={props.medicalNotes} onChange={e => props.setMedicalNotes(e.target.value)} placeholder="Optional" /></div>
            <Button onClick={props.handleReportMedical} className="w-full">Arzttermin einreichen</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-purple-600" />Arzttermine {year}</CardTitle>
          </CardHeader>
          <CardContent>
            {props.medicalLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Arzttermine vorhanden</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Zeit</TableHead><TableHead>Art</TableHead><TableHead>Dauer</TableHead><TableHead>Status</TableHead><TableHead>Aktion</TableHead></TableRow></TableHeader>
                <TableBody>
                  {props.medicalLeaves.map(m => {
                    const canCancel = (m.status === "pending" || m.status === "approved") && parseISO(m.start_date) > new Date();
                    const isCancelRequested = m.status === "cancel_requested";
                    return (
                      <TableRow key={m.id}>
                        <TableCell>{format(parseISO(m.start_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>{m.start_time && m.end_time ? `${m.start_time} - ${m.end_time}` : "-"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{getMedicalReasonLabel(m.medical_reason)}</Badge></TableCell>
                        <TableCell>{fmt(m.minutes_counted || 0)}</TableCell>
                        <TableCell>{getStatusBadge(m.status)}</TableCell>
                        <TableCell>
                          {canCancel && !isCancelRequested && (
                            <Button variant="ghost" size="sm" onClick={() => props.handleCancelMedicalRequest(m.id)} className="h-8 px-2 text-muted-foreground hover:text-destructive">
                              <Undo2 className="h-4 w-4 mr-1" />Stornieren
                            </Button>
                          )}
                          {isCancelRequested && <span className="text-xs text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3" />Wird geprüft</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overtime */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-amber-600" />Überstundenabbau beantragen</CardTitle>
            <CardDescription>Mehrstunden als freie Tage nehmen statt Urlaub</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <div className="flex justify-between">
                <span>Überstundensaldo (gesamt):</span>
                <span className={`font-mono font-bold ${props.yearlyBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {props.yearlyBalance >= 0 ? "+" : ""}{fmt(props.yearlyBalance)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Von</Label><Input type="date" value={props.overtimeStartDate} onChange={e => props.setOvertimeStartDate(e.target.value)} /></div>
              <div><Label>Bis</Label><Input type="date" value={props.overtimeEndDate} onChange={e => props.setOvertimeEndDate(e.target.value)} /></div>
            </div>
            <div><Label>Grund</Label><Textarea value={props.overtimeReason} onChange={e => props.setOvertimeReason(e.target.value)} placeholder="Optional" /></div>
            <Button onClick={props.handleRequestOvertimeReduction} className="w-full">Überstundenabbau beantragen</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-amber-600" />Überstundenabbau {year}</CardTitle>
          </CardHeader>
          <CardContent>
            {props.overtimeLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Überstundenabbau-Anträge vorhanden</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Von</TableHead><TableHead>Bis</TableHead><TableHead>Tage</TableHead><TableHead>Grund</TableHead><TableHead>Status</TableHead><TableHead>Aktion</TableHead></TableRow></TableHeader>
                <TableBody>
                  {props.overtimeLeaves.map(o => {
                    const d = eachDayOfInterval({ start: parseISO(o.start_date), end: parseISO(o.end_date) }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
                    const canCancel = (o.status === "pending" || o.status === "approved") && parseISO(o.start_date) > new Date();
                    const isCancelRequested = o.status === "cancel_requested";
                    return (
                      <TableRow key={o.id}>
                        <TableCell>{format(parseISO(o.start_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>{format(parseISO(o.end_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>{d}</TableCell>
                        <TableCell>{o.reason || "-"}</TableCell>
                        <TableCell>{getStatusBadge(o.status)}</TableCell>
                        <TableCell>
                          {canCancel && !isCancelRequested && (
                            <Button variant="ghost" size="sm" onClick={() => props.handleCancelOvertimeRequest(o.id)} className="h-8 px-2 text-muted-foreground hover:text-destructive">
                              <Undo2 className="h-4 w-4 mr-1" />Stornieren
                            </Button>
                          )}
                          {isCancelRequested && <span className="text-xs text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3" />Wird geprüft</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <VacationHistoryDialog
        open={vacationHistoryOpen}
        onOpenChange={setVacationHistoryOpen}
      />
    </div>
  );
}
