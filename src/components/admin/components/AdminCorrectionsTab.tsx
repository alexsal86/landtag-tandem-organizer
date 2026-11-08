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
    <Card className="overflow-hidden rounded-2xl shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <CardTitle className="text-lg">Saldo-Korrekturen</CardTitle>
          <CardDescription>Administrative Korrekturen des Stundensaldos</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onAddCorrection}>
          <Plus className="h-4 w-4 mr-2" />
          Korrektur
        </Button>
      </CardHeader>
      <CardContent className="p-0">
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
            <Table className="min-w-[600px] [&_th]:bg-muted/40 [&_th]:px-5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_td]:px-5 [&_td]:py-3">
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
                    <TableCell className="whitespace-nowrap font-mono tabular-nums">
                      {format(parseISO(corr.correction_date), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline"
                        className={`rounded-full border-0 font-mono tabular-nums ${
                          corr.correction_minutes >= 0
                            ? "bg-palette-green/20 text-palette-green"
                            : "bg-palette-red/20 text-palette-red"
                        }`}
                      >
                        {corr.correction_minutes >= 0 ? "+" : ""}
                        {fmt(corr.correction_minutes)}
                      </Badge>
                    </TableCell>
                    <TableCell>{corr.reason}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">
                      {format(
                        parseISO(corr.created_at ?? new Date().toISOString()),
                        "dd.MM.yyyy · HH:mm"
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
