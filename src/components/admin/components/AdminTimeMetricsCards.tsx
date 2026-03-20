import { format, getYear } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Clock, Gift, Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CombinedTimeEntry } from "@/hooks/useCombinedTimeEntries";
import { fmt } from "../utils/timeFormatting";

interface MonthBalance {
  month: Date;
  targetMinutes: number;
  workedMinutes: number;
  creditMinutes: number;
  overtimeReductionMinutes: number;
  balance: number;
}

interface AdminTimeMetricsCardsProps {
  currentMonth: Date;
  yearlyBalance: number;
  yearlyBreakdown: MonthBalance[];
  loadingYearlyBalance: boolean;
  totalCorrectionMinutes: number;
  monthlyTargetMinutes: number;
  workedMinutes: number;
  creditMinutes: number;
  overtimeReductionMinutes: number;
  balanceMinutes: number;
  totalActual: number;
  workdaysInMonth: number;
  dailyMinutes: number;
  combinedEntries: CombinedTimeEntry[];
  onCreateEntry: () => void;
  onAddCorrection: () => void;
  onShowBreakdown: () => void;
  onInitialBalance: () => void;
}

export function AdminTimeMetricsCards({
  currentMonth,
  yearlyBalance,
  yearlyBreakdown,
  loadingYearlyBalance,
  totalCorrectionMinutes,
  monthlyTargetMinutes,
  workedMinutes,
  creditMinutes,
  overtimeReductionMinutes,
  balanceMinutes,
  totalActual,
  workdaysInMonth,
  dailyMinutes,
  combinedEntries,
  onCreateEntry,
  onAddCorrection,
  onShowBreakdown,
  onInitialBalance,
}: AdminTimeMetricsCardsProps) {
  return (
    <>
      {/* Yearly balance card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Überstundensaldo {getYear(currentMonth)}
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onInitialBalance}
                className="text-xs"
              >
                Anfangsbestand
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onShowBreakdown}
                className="text-xs"
              >
                Aufschlüsselung
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingYearlyBalance ? (
            <div className="space-y-2">
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
            </div>
          ) : (
            <div className="flex items-baseline gap-4">
              <div
                className={`text-3xl font-bold ${yearlyBalance >= 0 ? "text-green-600" : "text-destructive"}`}
              >
                {yearlyBalance >= 0 ? "+" : ""}
                {fmt(yearlyBalance)}
              </div>
              {totalCorrectionMinutes !== 0 && (
                <span className="text-sm text-muted-foreground">
                  (inkl. {totalCorrectionMinutes >= 0 ? "+" : ""}
                  {fmt(totalCorrectionMinutes)} Korrekturen)
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">Summe aller Monate bis heute</p>
          {yearlyBreakdown.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {yearlyBreakdown.map((mb, idx) => (
                <TooltipProvider key={idx}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={mb.balance >= 0 ? "default" : "destructive"}
                        className={`cursor-help ${mb.balance >= 0 ? "bg-green-100 text-green-700 hover:bg-green-200" : ""}`}
                      >
                        {format(mb.month, "MMM", { locale: de })}:{" "}
                        {mb.balance >= 0 ? "+" : ""}
                        {fmt(mb.balance)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {format(mb.month, "MMMM yyyy", { locale: de })}
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Soll:</span>
                          <span>{fmt(mb.targetMinutes)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Gearbeitet:</span>
                          <span>{fmt(mb.workedMinutes)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Gutschriften:</span>
                          <span>+{fmt(mb.creditMinutes)}</span>
                        </div>
                        {mb.overtimeReductionMinutes > 0 && (
                          <div className="flex justify-between gap-4 text-amber-600">
                            <span>⏰ ÜA-Abbau:</span>
                            <span>{fmt(mb.overtimeReductionMinutes)}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-4 font-medium border-t pt-1">
                          <span>Saldo:</span>
                          <span
                            className={
                              mb.balance >= 0 ? "text-green-600" : "text-destructive"
                            }
                          >
                            {mb.balance >= 0 ? "+" : ""}
                            {fmt(mb.balance)}
                          </span>
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

      {/* Monthly metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Soll (dynamisch)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(monthlyTargetMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              {workdaysInMonth} Arbeitstage × {fmt(dailyMinutes)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Gearbeitet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(workedMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              {combinedEntries.filter((e) => e.entry_type === "work").length} Arbeitstage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Gutschriften
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="text-2xl font-bold text-blue-600">
                      +{fmt(creditMinutes)}
                    </div>
                    <p className="text-xs text-muted-foreground">Urlaub, Krankheit, etc.</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1 text-xs">
                    {combinedEntries.filter((e) => e.entry_type === "holiday").length > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>🎉 Feiertage:</span>
                        <span>
                          {combinedEntries.filter((e) => e.entry_type === "holiday").length} Tage
                          (kein Soll)
                        </span>
                      </div>
                    )}
                    {(() => {
                      const sickEntries = combinedEntries.filter((e) => e.entry_type === "sick");
                      return sickEntries.length > 0 ? (
                        <div className="flex justify-between gap-4">
                          <span>🤒 Krankheit:</span>
                          <span>
                            {sickEntries.length} Tage (
                            {fmt(sickEntries.reduce((s, e) => s + (e.minutes || 0), 0))})
                          </span>
                        </div>
                      ) : null;
                    })()}
                    {(() => {
                      const vacEntries = combinedEntries.filter(
                        (e) => e.entry_type === "vacation"
                      );
                      return vacEntries.length > 0 ? (
                        <div className="flex justify-between gap-4">
                          <span>🏖️ Urlaub:</span>
                          <span>
                            {vacEntries.length} Tage (
                            {fmt(vacEntries.reduce((s, e) => s + (e.minutes || 0), 0))})
                          </span>
                        </div>
                      ) : null;
                    })()}
                    {(() => {
                      const medEntries = combinedEntries.filter(
                        (e) => e.entry_type === "medical"
                      );
                      return medEntries.length > 0 ? (
                        <div className="flex justify-between gap-4">
                          <span>🏥 Arzttermine:</span>
                          <span>
                            {medEntries.length}× (
                            {fmt(medEntries.reduce((s, e) => s + (e.minutes || 0), 0))})
                          </span>
                        </div>
                      ) : null;
                    })()}
                    {(() => {
                      const otEntries = combinedEntries.filter(
                        (e) => e.entry_type === "overtime_reduction"
                      );
                      return otEntries.length > 0 ? (
                        <div className="flex justify-between gap-4 border-t pt-1 mt-1">
                          <span>⏰ Überstundenabbau:</span>
                          <span>
                            {otEntries.length} Tage (
                            {fmt(otEntries.reduce((s, e) => s + (e.minutes || 0), 0))}) —
                            reduziert Saldo
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monatssaldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div
                      className={`text-2xl font-bold ${balanceMinutes >= 0 ? "text-green-600" : "text-destructive"}`}
                    >
                      {balanceMinutes >= 0 ? "+" : ""}
                      {fmt(balanceMinutes)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gesamt-Ist: {fmt(totalActual)}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {format(currentMonth, "MMMM yyyy", { locale: de })}
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Soll:</span>
                      <span>{fmt(monthlyTargetMinutes)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Gearbeitet:</span>
                      <span>{fmt(workedMinutes)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Gutschriften:</span>
                      <span>+{fmt(creditMinutes)}</span>
                    </div>
                    {overtimeReductionMinutes > 0 && (
                      <div className="flex justify-between gap-4 text-amber-600">
                        <span>⏰ ÜA-Abbau:</span>
                        <span>{fmt(overtimeReductionMinutes)} (reduziert Saldo)</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 font-medium border-t pt-1">
                      <span>Saldo:</span>
                      <span
                        className={
                          balanceMinutes >= 0 ? "text-green-600" : "text-destructive"
                        }
                      >
                        {balanceMinutes >= 0 ? "+" : ""}
                        {fmt(balanceMinutes)}
                      </span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktionen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="default" size="sm" onClick={onCreateEntry} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Eintrag erstellen
            </Button>
            <Button variant="outline" size="sm" onClick={onAddCorrection} className="w-full">
              <TrendingUp className="h-4 w-4 mr-2" />
              Korrektur hinzufügen
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
