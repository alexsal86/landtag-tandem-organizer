import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmployeeInfoTab } from "@/features/employees/components/EmployeeInfoTab";
import { LeaveRequestsTab } from "@/components/timetracking/LeaveRequestsTab";
import { useTimeTrackingData } from "@/components/timetracking/hooks/useTimeTrackingData";
import { useTimeTrackingOperations } from "@/components/timetracking/hooks/useTimeTrackingOperations";
import { fmt } from "@/components/timetracking/types";
import type { TimeEntryRow } from "@/components/timetracking/types";
import { format, parseISO, addMonths, subMonths, getYear } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Edit, Trash2, TrendingUp } from "lucide-react";

export function TimeTrackingView() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showBreakdownDialog, setShowBreakdownDialog] = useState(false);

  const data = useTimeTrackingData(user?.id ?? null, selectedMonth);
  const ops = useTimeTrackingOperations({
    userId: user?.id ?? null,
    loadData: data.loadData,
    vacationLeaves: data.vacationLeaves,
    medicalLeaves: data.medicalLeaves,
    overtimeLeaves: data.overtimeLeaves,
  });

  if (data.loading) return <div className="p-4">Lädt...</div>;
  if (!data.employeeSettings) return <div className="p-4">Keine Einstellungen.</div>;

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Month Selector */}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-2xl">{format(selectedMonth, "MMMM yyyy", { locale: de })}</CardTitle>
            <Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 12 }, (_, i) => {
              const monthDate = new Date(selectedMonth.getFullYear(), i, 1);
              const isSelected = i === selectedMonth.getMonth();
              return (
                <Button key={i} variant={isSelected ? "default" : "outline"} size="sm" onClick={() => setSelectedMonth(monthDate)} className={`min-w-[60px] ${isSelected ? "font-bold" : ""}`}>
                  {format(monthDate, "MMM", { locale: de })}
                </Button>
              );
            })}
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="time-tracking">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="time-tracking">Zeiterfassung</TabsTrigger>
          <TabsTrigger value="leave-requests">Urlaub & Krankmeldungen</TabsTrigger>
          <TabsTrigger value="employee-info">Mitarbeiter-Info</TabsTrigger>
        </TabsList>

        <TabsContent value="time-tracking" className="space-y-6">
          {/* Yearly balance card */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />Mein Überstundensaldo {getYear(selectedMonth)}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowBreakdownDialog(true)} className="text-xs">Aufschlüsselung</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${data.yearlyBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
                {data.yearlyBalance >= 0 ? "+" : ""}{fmt(data.yearlyBalance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Summe aller Monate bis heute</p>
              {data.yearlyBreakdown.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.yearlyBreakdown.map((mb, idx) => (
                    <TooltipProvider key={idx}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant={mb.balance >= 0 ? "default" : "destructive"} className={`cursor-help ${mb.balance >= 0 ? "bg-green-100 text-green-700 hover:bg-green-200" : ""}`}>
                            {format(mb.month, "MMM", { locale: de })}: {mb.balance >= 0 ? "+" : ""}{fmt(mb.balance)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          <div className="space-y-1">
                            <div className="font-medium">{format(mb.month, "MMMM yyyy", { locale: de })}</div>
                            <div className="flex justify-between gap-4"><span>Soll:</span><span>{fmt(mb.targetMinutes)}</span></div>
                            <div className="flex justify-between gap-4"><span>Gearbeitet:</span><span>{fmt(mb.workedMinutes)}</span></div>
                            <div className="flex justify-between gap-4"><span>Gutschriften:</span><span>+{fmt(mb.creditMinutes)}</span></div>
                            <div className="flex justify-between gap-4 font-medium border-t pt-1">
                              <span>Saldo:</span>
                              <span className={mb.balance >= 0 ? "text-green-600" : "text-destructive"}>{mb.balance >= 0 ? "+" : ""}{fmt(mb.balance)}</span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly overview + Entry form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Zeitübersicht {format(selectedMonth, "MMMM yyyy", { locale: de })}</CardTitle>
                <CardDescription>{data.monthlyTotals.workingDays} Arbeitstage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm"><span>📊</span><span>MONATSBILANZ</span></div>
                  <div className="pl-6 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Gearbeitet:</span><span className="font-mono">{fmt(data.monthlyTotals.worked)}</span></div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex justify-between cursor-help"><span className="text-muted-foreground">Gutschriften:</span><span className="font-mono text-blue-600">+{fmt(data.monthlyTotals.credit)}</span></div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <div className="space-y-1 text-xs">
                            {data.monthlyTotals.holidayCount > 0 && <div className="flex justify-between gap-4"><span>🎉 Feiertage:</span><span className="font-mono">{data.monthlyTotals.holidayCount} Tage (kein Soll)</span></div>}
                            {data.monthlyTotals.sickMinutes > 0 && <div className="flex justify-between gap-4"><span>🤒 Krankheit:</span><span className="font-mono">{fmt(data.monthlyTotals.sickMinutes)}</span></div>}
                            {data.monthlyTotals.vacationMinutes > 0 && <div className="flex justify-between gap-4"><span>🏖️ Urlaub:</span><span className="font-mono">{fmt(data.monthlyTotals.vacationMinutes)}</span></div>}
                            {data.monthlyTotals.overtimeMinutes > 0 && <div className="flex justify-between gap-4"><span>⏰ Überstundenabbau (Abzug):</span><span className="font-mono text-amber-700 dark:text-amber-300">-{fmt(data.monthlyTotals.overtimeMinutes)}</span></div>}
                            {data.monthlyTotals.medicalMinutes > 0 && <div className="flex justify-between gap-4"><span>🏥 Arzttermine:</span><span className="font-mono">{fmt(data.monthlyTotals.medicalMinutes)}</span></div>}
                            {data.monthlyTotals.credit === 0 && <p className="text-muted-foreground">Keine Gutschriften in diesem Monat</p>}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="flex justify-between border-t pt-1 mt-1"><span className="font-medium">Gesamt (Ist):</span><span className="font-mono font-bold">{fmt(data.monthlyTotals.totalActual)}</span></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm"><span>🎯</span><span>SOLL/IST VERGLEICH</span></div>
                  <div className="pl-6 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Monatssoll:</span><span className="font-mono">{fmt(data.monthlyTotals.target)}</span></div>
                    <div className="flex justify-between">
                      <span className={data.monthlyTotals.difference >= 0 ? "text-green-600" : "text-red-600"}>Differenz:</span>
                      <span className={`font-mono font-bold ${data.monthlyTotals.difference >= 0 ? "text-green-600" : "text-red-600"}`}>{data.monthlyTotals.difference >= 0 ? "+" : ""}{fmt(Math.abs(data.monthlyTotals.difference))}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span className="font-mono">{data.monthlyTotals.target > 0 ? Math.round(data.monthlyTotals.totalActual / data.monthlyTotals.target * 100) : 0}% erfüllt</span></div>
                  </div>
                </div>
                {data.projectionTotals && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm"><span>⏱️</span><span>HOCHRECHNUNG BIS HEUTE</span></div>
                    <div className="pl-6 space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Soll ({data.projectionTotals.workedDaysSoFar}/{data.monthlyTotals.workingDays} AT):</span><span className="font-mono">{fmt(data.projectionTotals.targetSoFar)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Gearbeitet:</span><span className="font-mono">{fmt(data.projectionTotals.workedSoFar || 0)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">+ Gutschriften:</span><span className="font-mono text-blue-600">+{fmt(data.projectionTotals.creditSoFar || 0)}</span></div>
                      <div className="flex justify-between">
                        <span className={data.projectionTotals.differenceSoFar >= 0 ? "text-green-600" : "text-red-600"}>Differenz:</span>
                        <span className={`font-mono font-bold ${data.projectionTotals.differenceSoFar >= 0 ? "text-green-600" : "text-red-600"}`}>{data.projectionTotals.differenceSoFar >= 0 ? "+" : ""}{fmt(Math.abs(data.projectionTotals.differenceSoFar))}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="h-full">
              <CardHeader><CardTitle>Neue Zeiterfassung</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={ops.onSubmit} className="space-y-4">
                  <div className="grid grid-cols-5 gap-4">
                    <div><Label>Datum</Label><Input type="date" value={ops.entryDate} onChange={e => ops.setEntryDate(e.target.value)} required /></div>
                    <div><Label>Start</Label><Input type="time" value={ops.startTime} onChange={e => ops.setStartTime(e.target.value)} required /></div>
                    <div><Label>Ende</Label><Input type="time" value={ops.endTime} onChange={e => ops.setEndTime(e.target.value)} required /></div>
                    <div><Label>Pause (Min)</Label><Input type="number" value={ops.pauseMinutes} onChange={e => ops.setPauseMinutes(e.target.value)} min="0" /></div>
                    <div className="flex items-end"><Button type="submit" className="w-full">Erfassen</Button></div>
                  </div>
                  <div><Label>Notizen</Label><Input value={ops.notes} onChange={e => ops.setNotes(e.target.value)} placeholder="Optional" /></div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Time entries table */}
          <Card>
            <CardHeader>
              <CardTitle>Zeiteinträge</CardTitle>
              <CardDescription>Arbeitszeit, Urlaub, Krankheit und Feiertage</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead><TableHead>Typ</TableHead><TableHead>Start</TableHead><TableHead>Ende</TableHead><TableHead>Pause</TableHead><TableHead>Brutto</TableHead><TableHead>Netto</TableHead><TableHead>Notizen</TableHead><TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.combinedEntries.map(entry => {
                    const gross = entry.started_at && entry.ended_at ? Math.round((new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000) : entry.minutes || 0;
                    return (
                      <TableRow key={entry.id} className={entry.type_class}>
                        <TableCell>{entry.type_icon && <span className="mr-1">{entry.type_icon}</span>}{format(parseISO(entry.work_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>{entry.type_label ? <Badge variant="outline" className="text-xs">{entry.type_label}</Badge> : <span className="text-muted-foreground text-xs">Arbeit</span>}</TableCell>
                        <TableCell>{entry.started_at ? format(parseISO(entry.started_at), "HH:mm") : "-"}</TableCell>
                        <TableCell>{entry.ended_at ? format(parseISO(entry.ended_at), "HH:mm") : "-"}</TableCell>
                        <TableCell>{entry.pause_minutes || 0} Min</TableCell>
                        <TableCell>{fmt(gross)}</TableCell>
                        <TableCell>{fmt(entry.minutes || 0)}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild><span className="block truncate cursor-help">{entry.notes || "-"}</span></TooltipTrigger>
                                {entry.notes && entry.notes.length > 30 && <TooltipContent className="max-w-md whitespace-pre-wrap">{entry.notes}</TooltipContent>}
                              </Tooltip>
                            </TooltipProvider>
                            {entry.edited_by && entry.edited_at && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-800 shrink-0">✏️</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">Bearbeitet von Admin</p>
                                    <p className="text-xs text-muted-foreground">{format(parseISO(entry.edited_at), "dd.MM.yyyy HH:mm")}</p>
                                    {entry.edit_reason && <p className="text-xs mt-1">Grund: {entry.edit_reason}</p>}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {entry.is_editable && entry.entry_type === "work" && (
                              <Button variant="ghost" size="icon" onClick={() => ops.handleEditEntry(entry as TimeEntryRow)} title="Bearbeiten"><Edit className="h-4 w-4" /></Button>
                            )}
                            {entry.is_deletable && (
                              <Button variant="ghost" size="icon" onClick={() => ops.handleDeleteEntry(entry.id)} title="Löschen"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {data.combinedEntries.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Keine Einträge in diesem Monat</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Edit Dialog */}
          <Dialog open={ops.isEditDialogOpen} onOpenChange={ops.setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Zeiteintrag bearbeiten</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4"><div><Label>Datum</Label><Input type="date" value={ops.entryDate} onChange={e => ops.setEntryDate(e.target.value)} required /></div></div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Start</Label><Input type="time" value={ops.startTime} onChange={e => ops.setStartTime(e.target.value)} required /></div>
                  <div><Label>Ende</Label><Input type="time" value={ops.endTime} onChange={e => ops.setEndTime(e.target.value)} required /></div>
                  <div><Label>Pause (Min)</Label><Input type="number" value={ops.pauseMinutes} onChange={e => ops.setPauseMinutes(e.target.value)} min="0" /></div>
                </div>
                <div><Label>Notizen</Label><Textarea value={ops.notes} onChange={e => ops.setNotes(e.target.value)} placeholder="Optional" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => ops.setIsEditDialogOpen(false)}>Abbrechen</Button>
                <Button onClick={ops.handleUpdateEntry}>Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="leave-requests" className="space-y-6">
          <LeaveRequestsTab
            selectedMonth={selectedMonth}
            pendingLeaves={data.pendingLeaves}
            vacationLeaves={data.vacationLeaves}
            sickLeaves={data.sickLeaves}
            medicalLeaves={data.medicalLeaves}
            overtimeLeaves={data.overtimeLeaves}
            employeeSettings={data.employeeSettings}
            vacationBalance={data.vacationBalance}
            yearlyBalance={data.yearlyBalance}
            vacationStartDate={ops.vacationStartDate} setVacationStartDate={ops.setVacationStartDate}
            vacationEndDate={ops.vacationEndDate} setVacationEndDate={ops.setVacationEndDate}
            vacationReason={ops.vacationReason} setVacationReason={ops.setVacationReason}
            handleRequestVacation={ops.handleRequestVacation}
            handleCancelVacationRequest={ops.handleCancelVacationRequest}
            vacationDeputy={ops.vacationDeputy} setVacationDeputy={ops.setVacationDeputy}
            vacationChecklistItems={ops.vacationChecklistItems} setVacationChecklistItems={ops.setVacationChecklistItems}
            sickStartDate={ops.sickStartDate} setSickStartDate={ops.setSickStartDate}
            sickEndDate={ops.sickEndDate} setSickEndDate={ops.setSickEndDate}
            sickNotes={ops.sickNotes} setSickNotes={ops.setSickNotes}
            handleReportSick={ops.handleReportSick}
            sickDeputy={ops.sickDeputy} setSickDeputy={ops.setSickDeputy}
            medicalDate={ops.medicalDate} setMedicalDate={ops.setMedicalDate}
            medicalStartTime={ops.medicalStartTime} setMedicalStartTime={ops.setMedicalStartTime}
            medicalEndTime={ops.medicalEndTime} setMedicalEndTime={ops.setMedicalEndTime}
            medicalReason={ops.medicalReason} setMedicalReason={ops.setMedicalReason}
            medicalNotes={ops.medicalNotes} setMedicalNotes={ops.setMedicalNotes}
            handleReportMedical={ops.handleReportMedical}
            handleCancelMedicalRequest={ops.handleCancelMedicalRequest}
            overtimeStartDate={ops.overtimeStartDate} setOvertimeStartDate={ops.setOvertimeStartDate}
            overtimeEndDate={ops.overtimeEndDate} setOvertimeEndDate={ops.setOvertimeEndDate}
            overtimeReason={ops.overtimeReason} setOvertimeReason={ops.setOvertimeReason}
            handleRequestOvertimeReduction={ops.handleRequestOvertimeReduction}
            handleCancelOvertimeRequest={ops.handleCancelOvertimeRequest}
          />
        </TabsContent>

        <TabsContent value="employee-info" className="space-y-6">
          <EmployeeInfoTab employeeSettings={data.employeeSettings} />
        </TabsContent>
      </Tabs>

      {/* Yearly breakdown dialog */}
      <Dialog open={showBreakdownDialog} onOpenChange={setShowBreakdownDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Überstunden-Aufschlüsselung {getYear(selectedMonth)}</DialogTitle>
            <DialogDescription>Monatliche Entwicklung deines Überstundensaldos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Monat</TableHead><TableHead className="text-right">Soll</TableHead><TableHead className="text-right">Gearbeitet</TableHead><TableHead className="text-right">Gutschriften</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Kumuliert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.yearlyBreakdown.map((mb, idx) => {
                    const cumulative = data.yearlyBreakdown.slice(0, idx + 1).reduce((sum, m) => sum + m.balance, 0);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{format(mb.month, "MMMM", { locale: de })}</TableCell>
                        <TableCell className="text-right">{fmt(mb.targetMinutes)}</TableCell>
                        <TableCell className="text-right">{fmt(mb.workedMinutes)}</TableCell>
                        <TableCell className="text-right text-blue-600">+{fmt(mb.creditMinutes)}</TableCell>
                        <TableCell className={`text-right font-medium ${mb.balance >= 0 ? "text-green-600" : "text-destructive"}`}>{mb.balance >= 0 ? "+" : ""}{fmt(mb.balance)}</TableCell>
                        <TableCell className={`text-right font-bold ${cumulative >= 0 ? "text-green-600" : "text-destructive"}`}>{cumulative >= 0 ? "+" : ""}{fmt(cumulative)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4}>Gesamt {getYear(selectedMonth)}</TableCell>
                    <TableCell className={`text-right ${data.yearlyBalance >= 0 ? "text-green-600" : "text-destructive"}`}>{data.yearlyBalance >= 0 ? "+" : ""}{fmt(data.yearlyBalance)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="bg-muted/50 rounded-md p-3 text-sm">
              <p className="font-medium mb-1">Legende:</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li><strong>Soll:</strong> Arbeitstage im Monat × tägliche Arbeitszeit (ohne Feiertage)</li>
                <li><strong>Gearbeitet:</strong> Tatsächlich erfasste Arbeitszeit</li>
                <li><strong>Gutschriften:</strong> Urlaub, Krankheit, Arzttermine</li>
                <li><strong>Überstundenabbau:</strong> Baut vorhandenen Saldo ab (wird abgezogen)</li>
                <li><strong>Saldo:</strong> Gearbeitet + Gutschriften − Soll − Überstundenabbau</li>
                <li><strong>Kumuliert:</strong> Laufende Summe aller Monats-Salden</li>
              </ul>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowBreakdownDialog(false)}>Schließen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={ops.confirmState.open}
        onOpenChange={(open) => ops.setConfirmState((s) => ({ ...s, open }))}
        title={ops.confirmState.title}
        description={ops.confirmState.description}
        onConfirm={() => { ops.setConfirmState((s) => ({ ...s, open: false })); ops.confirmState.onConfirm(); }}
        confirmLabel="Ja, fortfahren"
        cancelLabel="Abbrechen"
        destructive
      />
    </div>
  );
}
