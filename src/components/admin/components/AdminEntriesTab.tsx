import { format, isWeekend, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Clock, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CombinedTimeEntry } from "@/hooks/useCombinedTimeEntries";
import { getLeaveAccentClass, getLeaveTypeBadge } from "../utils/badgeHelpers";
import { fmt } from "../utils/timeFormatting";
import type { PublicHoliday, TimeEntry } from "../types";

interface AdminEntriesTabProps {
  currentMonth: Date;
  combinedEntries: CombinedTimeEntry[];
  timeEntries: TimeEntry[];
  actualAfterEntryById: Map<string, number>;
  dailyMinutes: number;
  holidays: PublicHoliday[];
  onEditEntry: (entry: TimeEntry | undefined, combinedEntry: CombinedTimeEntry) => void;
}

export function AdminEntriesTab({
  currentMonth, combinedEntries, timeEntries, actualAfterEntryById, dailyMinutes, holidays, onEditEntry,
}: AdminEntriesTabProps) {
  // Display the existing monthly actual/target calculation per day, once even for split shifts.
  const holidayDates = new Set(holidays.map(holiday => holiday.holiday_date));
  const actualByDate = new Map<string, number>();
  combinedEntries.forEach(entry => {
    const actual = ["work", "sick", "vacation", "medical"].includes(entry.entry_type) ? entry.minutes || 0 : 0;
    actualByDate.set(entry.work_date, (actualByDate.get(entry.work_date) || 0) + actual);
  });
  const displayedDates = new Set<string>();

  return (
    <Card className="overflow-hidden rounded-2xl shadow-none">
      <CardHeader className="p-5">
        <CardTitle className="text-lg">Zeiteinträge {format(currentMonth, "MMMM yyyy", { locale: de })}</CardTitle>
        <CardDescription>Alle Einträge inkl. Abwesenheiten · Δ Soll pro Tag · Eintragsdetails über die Nettozeit</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {combinedEntries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>Keine Einträge in diesem Monat</p>
          </div>
        ) : (
          <Table className="min-w-[820px] [&_th]:bg-muted/40 [&_th]:px-5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_td]:px-5 [&_td]:py-3">
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Pause</TableHead>
                <TableHead className="text-right">Netto</TableHead>
                <TableHead className="text-right">Δ Soll</TableHead>
                <TableHead>Notizen</TableHead>
                <TableHead><span className="sr-only">Bearbeiten</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedEntries.map(entry => {
                const date = parseISO(entry.work_date);
                const grossMinutes = entry.started_at && entry.ended_at
                  ? Math.round((new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000)
                  : entry.minutes || 0;
                const dailyTarget = isWeekend(date) || holidayDates.has(entry.work_date) ? 0 : dailyMinutes;
                const dayActual = actualByDate.get(entry.work_date) || 0;
                const delta = dayActual - dailyTarget;
                const firstForDay = !displayedDates.has(entry.work_date);
                displayedDates.add(entry.work_date);

                return (
                  <TableRow key={entry.id}>
                    <TableCell className={`whitespace-nowrap border-l-4 ${getLeaveAccentClass(entry.entry_type)}`}>
                      <span className="font-semibold">{format(date, "EEE", { locale: de })}</span>{" "}
                      <span className="text-muted-foreground tabular-nums">{format(date, "dd.MM.")}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        {entry.entry_type === "work" ? <span className="text-xs text-muted-foreground">Arbeit</span>
                          : entry.entry_type === "holiday" ? <Badge variant="outline" className="rounded-full border-0 bg-palette-green/10 text-palette-green">{entry.type_icon} {entry.type_label}</Badge>
                          : getLeaveTypeBadge(entry.entry_type)}
                        {entry.edited_by && entry.entry_type === "work" && (
                          <TooltipProvider><Tooltip>
                            <TooltipTrigger asChild><Badge variant="outline" tabIndex={0} className="rounded-full border-0 bg-palette-blue/10 text-xs text-palette-blue">✏️ Bearbeitet</Badge></TooltipTrigger>
                            <TooltipContent><p>Bearbeitet am {entry.edited_at && format(parseISO(entry.edited_at), "dd.MM.yyyy HH:mm")}</p>{entry.edit_reason && <p>Grund: {entry.edit_reason}</p>}</TooltipContent>
                          </Tooltip></TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono tabular-nums">
                      {entry.started_at || entry.ended_at ? <>{entry.started_at ? format(parseISO(entry.started_at), "HH:mm") : "–"} – {entry.ended_at ? format(parseISO(entry.ended_at), "HH:mm") : "–"}</>
                        : <span className="font-sans text-xs text-muted-foreground">{entry.entry_type === "work" ? "Nicht erfasst" : "ganztägig"}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">{entry.entry_type === "work" ? `${entry.pause_minutes} min` : "–"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      <Popover>
                        <PopoverTrigger asChild><button type="button" aria-label={`Eintragsdetails vom ${format(date, "dd.MM.yyyy")}, ${fmt(entry.minutes || 0)} netto`} className="font-semibold underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 hover:text-primary">{fmt(entry.minutes || 0)}</button></PopoverTrigger>
                        <PopoverContent className="w-72 text-sm">
                          <h4 className="mb-3 font-semibold">Eintragsdetails · {format(date, "dd.MM.yyyy")}</h4>
                          <dl className="space-y-2">
                            <div className="flex justify-between"><dt>Brutto</dt><dd className="font-mono tabular-nums">{fmt(grossMinutes)}</dd></div>
                            <div className="flex justify-between"><dt>Pause</dt><dd className="font-mono tabular-nums">{entry.pause_minutes} min</dd></div>
                            <div className="flex justify-between"><dt>Netto</dt><dd className="font-mono tabular-nums">{fmt(entry.minutes || 0)}</dd></div>
                            <div className="flex justify-between border-t pt-2"><dt>Laufendes Gesamt-Ist</dt><dd className="font-mono tabular-nums">{fmt(actualAfterEntryById.get(entry.id) || 0)}</dd></div>
                          </dl>
                          {entry.notes && <p className="mt-3 whitespace-pre-wrap break-words border-t pt-2 text-muted-foreground">{entry.notes}</p>}
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono tabular-nums">
                      {firstForDay ? (
                        <span title={`Tagessaldo aller Einträge: ${fmt(dayActual)} Ist − ${fmt(dailyTarget)} Soll`} className={delta > 0 ? "text-palette-green" : delta < 0 ? "text-destructive" : "text-muted-foreground"}>{delta > 0 ? "+" : delta === 0 ? "±" : ""}{fmt(delta)}</span>
                      ) : <span className="text-muted-foreground" title="Tagessaldo beim ersten Eintrag dieses Tages">–</span>}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground" title={entry.notes || undefined}>{entry.notes || "–"}</TableCell>
                    <TableCell>
                      {(entry.entry_type === "work" || ["vacation", "sick", "overtime_reduction"].includes(entry.entry_type)) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" aria-label={`Eintrag vom ${format(date, "dd.MM.yyyy")} bearbeiten`} onClick={() => onEditEntry(entry.entry_type === "work" ? timeEntries.find(original => original.id === entry.id) : undefined, entry)}><Edit className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
