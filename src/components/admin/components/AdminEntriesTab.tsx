import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CombinedTimeEntry } from "@/hooks/useCombinedTimeEntries";
import { fmt } from "../utils/timeFormatting";
import type { TimeEntry } from "../types";

interface AdminEntriesTabProps {
  currentMonth: Date;
  combinedEntries: CombinedTimeEntry[];
  timeEntries: TimeEntry[];
  actualAfterEntryById: Map<string, number>;
  onEditEntry: (entry: TimeEntry, combinedEntry: CombinedTimeEntry) => void;
}

export function AdminEntriesTab({
  currentMonth,
  combinedEntries,
  timeEntries,
  actualAfterEntryById,
  onEditEntry,
}: AdminEntriesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Zeiteinträge {format(currentMonth, "MMMM yyyy", { locale: de })}
        </CardTitle>
        <CardDescription>Alle Einträge inkl. Abwesenheiten für diesen Monat</CardDescription>
      </CardHeader>
      <CardContent>
        {combinedEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Keine Einträge in diesem Monat</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Gesamt-Ist</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Ende</TableHead>
                <TableHead>Brutto</TableHead>
                <TableHead>Pause</TableHead>
                <TableHead>Netto</TableHead>
                <TableHead>Notizen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedEntries.map((entry) => {
                const grossMinutes =
                  entry.started_at && entry.ended_at
                    ? Math.round(
                        (new Date(entry.ended_at).getTime() -
                          new Date(entry.started_at).getTime()) /
                          60000
                      )
                    : entry.minutes || 0;

                return (
                  <TableRow key={entry.id} className={entry.type_class}>
                    <TableCell className="font-medium">
                      {format(parseISO(entry.work_date), "EEE, dd.MM.", { locale: de })}
                    </TableCell>
                    <TableCell>
                      {entry.type_label ? (
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {entry.type_icon} {entry.type_label}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Arbeit</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {fmt(actualAfterEntryById.get(entry.id) || 0)}
                    </TableCell>
                    <TableCell>
                      {entry.started_at ? format(parseISO(entry.started_at), "HH:mm") : "-"}
                    </TableCell>
                    <TableCell>
                      {entry.ended_at ? format(parseISO(entry.ended_at), "HH:mm") : "-"}
                    </TableCell>
                    <TableCell className="font-mono">{fmt(grossMinutes)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.pause_minutes}m
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {fmt(entry.minutes || 0)}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">
                      {entry.notes || "-"}
                    </TableCell>
                    <TableCell>
                      {entry.edited_by && entry.entry_type === "work" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200"
                              >
                                ✏️ Bearbeitet
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Bearbeitet am{" "}
                                {entry.edited_at &&
                                  format(parseISO(entry.edited_at), "dd.MM.yyyy HH:mm")}
                              </p>
                              {entry.edit_reason && <p>Grund: {entry.edit_reason}</p>}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                    <TableCell>
                      {(
                        entry.entry_type === "work" ||
                        ["vacation", "sick", "overtime_reduction"].includes(entry.entry_type)
                      ) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const original =
                              entry.entry_type === "work"
                                ? timeEntries.find((e) => e.id === entry.id)
                                : undefined;
                            onEditEntry(original as TimeEntry, entry);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
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
