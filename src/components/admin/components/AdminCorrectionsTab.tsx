import { format, parseISO } from "date-fns";
import { Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt } from "../utils/timeFormatting";
import type { Correction } from "../types";

interface AdminCorrectionsTabProps {
  corrections: Correction[];
  onAddCorrection: () => void;
}

export function AdminCorrectionsTab({ corrections, onAddCorrection }: AdminCorrectionsTabProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Saldo-Korrekturen</CardTitle>
          <CardDescription>Administrative Korrekturen des Stundensaldos</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onAddCorrection}>
          <Plus className="h-4 w-4 mr-2" />
          Korrektur
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {corrections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Keine Korrekturen vorhanden</p>
              <p className="text-sm mt-2">
                Hier können Sie Überstunden manuell korrigieren, z.B. auf Null setzen.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Korrektur</TableHead>
                  <TableHead>Grund</TableHead>
                  <TableHead>Erstellt am</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corrections.map((corr) => (
                  <TableRow key={corr.id}>
                    <TableCell>
                      {format(parseISO(corr.correction_date), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          corr.correction_minutes >= 0
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {corr.correction_minutes >= 0 ? "+" : ""}
                        {fmt(corr.correction_minutes)}
                      </Badge>
                    </TableCell>
                    <TableCell>{corr.reason}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(
                        parseISO(corr.created_at ?? new Date().toISOString()),
                        "dd.MM.yyyy HH:mm"
                      )}
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
