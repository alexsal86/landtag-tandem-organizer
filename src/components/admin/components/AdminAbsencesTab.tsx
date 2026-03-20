import { format, parseISO } from "date-fns";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLeaveTypeBadge, getStatusBadge } from "../utils/badgeHelpers";
import type { LeaveRequest } from "../types";

interface AdminAbsencesTabProps {
  leaveRequests: LeaveRequest[];
}

export function AdminAbsencesTab({ leaveRequests }: AdminAbsencesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Abwesenheitshistorie</CardTitle>
        <CardDescription>
          Alle Urlaubs-, Krankheits- und sonstige Abwesenheitsanträge
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {leaveRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Keine Abwesenheiten erfasst</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notizen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{getLeaveTypeBadge(req.type)}</TableCell>
                    <TableCell>
                      {format(parseISO(req.start_date), "dd.MM.yyyy")}
                      {req.end_date && req.end_date !== req.start_date && (
                        <> – {format(parseISO(req.end_date), "dd.MM.yyyy")}</>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {req.reason || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
