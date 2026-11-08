import { format, parseISO } from "date-fns";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateWorkingDays } from "@/components/employees/types";
import { getLeaveAccentClass, getLeaveTypeBadge, getStatusBadge } from "../utils/badgeHelpers";
import type { LeaveRequest } from "../types";

interface AdminAbsencesTabProps {
  leaveRequests: LeaveRequest[];
}

export function AdminAbsencesTab({ leaveRequests }: AdminAbsencesTabProps) {
  return (
    <Card className="overflow-hidden rounded-2xl shadow-none">
      <CardHeader className="p-5">
        <CardTitle className="text-lg">Abwesenheitshistorie</CardTitle>
        <CardDescription>
          Alle Urlaubs-, Krankheits- und sonstige Abwesenheitsanträge
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {leaveRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Keine Abwesenheiten erfasst</p>
            </div>
          ) : (
            <Table className="min-w-[640px] [&_th]:bg-muted/40 [&_th]:px-5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_td]:px-5 [&_td]:py-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notizen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((req) => {
                  const days = calculateWorkingDays(req.start_date, req.end_date || req.start_date);
                  return (
                  <TableRow key={req.id}>
                    <TableCell className={`border-l-4 ${getLeaveAccentClass(req.type)}`}>{getLeaveTypeBadge(req.type)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {format(parseISO(req.start_date), "dd.MM.yyyy")}
                      {req.end_date && req.end_date !== req.start_date && (
                        <> – {format(parseISO(req.end_date), "dd.MM.yyyy")}</>
                      )}
                      <span className="ml-1 text-xs text-muted-foreground">· {days} {days === 1 ? "Arbeitstag" : "Arbeitstage"}</span>
                      {req.minutes_counted != null && <span className="block text-xs text-muted-foreground">{req.minutes_counted} min angerechnet</span>}
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-muted-foreground" title={req.reason || undefined}>
                      {req.reason || "-"}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
