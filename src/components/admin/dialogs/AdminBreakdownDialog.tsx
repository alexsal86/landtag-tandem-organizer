import { format, getYear } from "date-fns";
import { de } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt } from "../utils/timeFormatting";
import type { Employee } from "../types";

interface MonthBalance {
  month: Date;
  targetMinutes: number;
  workedMinutes: number;
  creditMinutes: number;
  overtimeReductionMinutes: number;
  balance: number;
}

interface AdminBreakdownDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEmployee: Employee | undefined;
  currentMonth: Date;
  yearlyBalance: number;
  yearlyBreakdown: MonthBalance[];
  totalCorrectionMinutes: number;
}

export function AdminBreakdownDialog({
  isOpen,
  onOpenChange,
  selectedEmployee,
  currentMonth,
  yearlyBalance,
  yearlyBreakdown,
  totalCorrectionMinutes,
}: AdminBreakdownDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Überstunden-Aufschlüsselung {getYear(currentMonth)}</DialogTitle>
          <DialogDescription>
            Monatliche Entwicklung des Überstundensaldos für {selectedEmployee?.display_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Monat</TableHead>
                  <TableHead className="text-right">Soll</TableHead>
                  <TableHead className="text-right">Gearbeitet</TableHead>
                  <TableHead className="text-right">Gutschriften</TableHead>
                  <TableHead className="text-right">ÜA-Abbau</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Kumuliert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearlyBreakdown.map((mb, idx) => {
                  const cumulative = yearlyBreakdown
                    .slice(0, idx + 1)
                    .reduce((sum, m) => sum + m.balance, 0);
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {format(mb.month, "MMMM", { locale: de })}
                      </TableCell>
                      <TableCell className="text-right">{fmt(mb.targetMinutes)}</TableCell>
                      <TableCell className="text-right">{fmt(mb.workedMinutes)}</TableCell>
                      <TableCell className="text-right text-blue-600">
                        +{fmt(mb.creditMinutes)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {mb.overtimeReductionMinutes > 0 ? fmt(mb.overtimeReductionMinutes) : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${mb.balance >= 0 ? "text-green-600" : "text-destructive"}`}
                      >
                        {mb.balance >= 0 ? "+" : ""}
                        {fmt(mb.balance)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${cumulative >= 0 ? "text-green-600" : "text-destructive"}`}
                      >
                        {cumulative >= 0 ? "+" : ""}
                        {fmt(cumulative)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {totalCorrectionMinutes !== 0 && (
                  <TableRow className="border-t-2">
                    <TableCell colSpan={5} className="font-medium">
                      Korrekturen (gesamt)
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${totalCorrectionMinutes >= 0 ? "text-green-600" : "text-destructive"}`}
                    >
                      {totalCorrectionMinutes >= 0 ? "+" : ""}
                      {fmt(totalCorrectionMinutes)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={5}>Gesamt {getYear(currentMonth)}</TableCell>
                  <TableCell
                    className={`text-right ${yearlyBalance >= 0 ? "text-green-600" : "text-destructive"}`}
                  >
                    {yearlyBalance >= 0 ? "+" : ""}
                    {fmt(yearlyBalance)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="bg-muted/50 rounded-md p-3 text-sm">
            <p className="font-medium mb-1">Legende:</p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>
                <strong>Soll:</strong> Arbeitstage im Monat × tägliche Arbeitszeit (ohne
                Feiertage)
              </li>
              <li>
                <strong>Gearbeitet:</strong> Tatsächlich erfasste Arbeitszeit
              </li>
              <li>
                <strong>Gutschriften:</strong> Urlaub, Krankheit, Arzttermine (zählen als
                gearbeitet)
              </li>
              <li>
                <strong>Überstundenabbau:</strong> Reduziert den Überstundensaldo
              </li>
              <li>
                <strong>Saldo:</strong> Gearbeitet + Gutschriften − Soll − Überstundenabbau
              </li>
              <li>
                <strong>Kumuliert:</strong> Laufende Summe aller Monats-Salden
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
