import { format, getYear } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Clock, Gift, Plus, TrendingUp } from "lucide-react";
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
      <Card className="overflow-hidden rounded-2xl shadow-none">
        <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(240px,1fr)_2fr] lg:items-center">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Überstundensaldo {getYear(currentMonth)}</h3>
            {loadingYearlyBalance ? (
              <div role="status" aria-label="Saldo wird geladen" className="my-2 h-10 w-40 animate-pulse rounded bg-muted" />
            ) : (
              <div className={`mt-1 font-mono text-4xl font-bold tracking-tight tabular-nums ${yearlyBalance >= 0 ? "text-palette-green" : "text-destructive"}`}>
                {yearlyBalance >= 0 ? "+" : ""}{fmt(yearlyBalance)}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {totalCorrectionMinutes !== 0 && <>inkl. {totalCorrectionMinutes >= 0 ? "+" : ""}{fmt(totalCorrectionMinutes)} Korrekturen · </>}
              Summe aller Monate bis heute
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onInitialBalance} className="rounded-xl">Anfangsbestand</Button>
              <Button variant="outline" size="sm" onClick={onShowBreakdown} className="rounded-xl">Aufschlüsselung</Button>
            </div>
          </div>
          {loadingYearlyBalance ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          ) : yearlyBreakdown.length > 0 ? (
            <TooltipProvider>
              <div role="group" aria-label="Monatliche Stundensalden, positive Werte oberhalb und negative unterhalb der Nulllinie" className="overflow-x-auto">
                <div className="relative flex min-w-[320px] gap-1.5">
                  <div aria-hidden="true" className="pointer-events-none absolute left-0 right-0 top-12 border-t border-border" />
                  {yearlyBreakdown.map((mb) => {
                    const current = format(mb.month, "yyyy-MM") === format(currentMonth, "yyyy-MM");
                    const max = Math.max(1, ...yearlyBreakdown.map(month => Math.abs(month.balance)));
                    const height = mb.balance === 0 ? 2 : Math.max(3, Math.abs(mb.balance) / max * 44);
                    const color = mb.balance >= 0
                      ? current ? "bg-palette-green" : "bg-palette-green/25 border-palette-green"
                      : current ? "bg-destructive" : "bg-destructive/15 border-destructive/60";
                    return (
                      <Tooltip key={format(mb.month, "yyyy-MM")}>
                        <TooltipTrigger asChild>
                          <button type="button" aria-label={`${format(mb.month, "MMMM yyyy", { locale: de })}: ${mb.balance >= 0 ? "+" : ""}${fmt(mb.balance)}${current ? ", ausgewählter Monat" : ""}`} className={`relative flex min-w-0 flex-1 flex-col items-center rounded-lg px-0.5 pb-1 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring ${current ? "bg-muted/60 font-semibold" : "text-muted-foreground"}`}>
                            <span className="flex h-12 w-full items-end justify-center">
                              {mb.balance >= 0 && <span className={`block w-full max-w-7 rounded-t border-t-2 ${color}`} style={{ height }} />}
                            </span>
                            <span className="flex h-12 w-full items-start justify-center">
                              {mb.balance < 0 && <span className={`block w-full max-w-7 rounded-b border-b-2 ${color}`} style={{ height }} />}
                            </span>
                            <span className={`mt-1 text-[10px] sm:text-xs ${current ? "text-foreground" : ""}`}>{format(mb.month, "MMM", { locale: de }).slice(0, 3)}</span>
                          </button>
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
                              <div className="flex justify-between gap-4 text-palette-amber">
                                <span>⏰ ÜA-Abbau:</span>
                                <span>{fmt(mb.overtimeReductionMinutes)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-4 font-medium border-t pt-1">
                              <span>Saldo:</span>
                              <span
                                className={
                                  mb.balance >= 0 ? "text-palette-green" : "text-destructive"
                                }
                              >
                                {mb.balance >= 0 ? "+" : ""}
                                {fmt(mb.balance)}
                              </span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            </TooltipProvider>
          ) : <p className="text-sm text-muted-foreground">Noch keine Monatssalden vorhanden.</p>}
        </CardContent>
      </Card>

      {/* Monthly metric cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 [&>div]:rounded-2xl [&>div]:shadow-none">
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Soll (dynamisch)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="font-mono text-2xl font-bold tabular-nums">{fmt(monthlyTargetMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              {workdaysInMonth} Arbeitstage × {fmt(dailyMinutes)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Gearbeitet
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="font-mono text-2xl font-bold tabular-nums">{fmt(workedMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              {new Set(combinedEntries.filter((e) => e.entry_type === "work").map(entry => entry.work_date)).size} Arbeitstage
            </p>
            <div role="progressbar" aria-label="Gearbeitet im Verhältnis zum Monatssoll" aria-valuemin={0} aria-valuemax={100} aria-valuenow={monthlyTargetMinutes > 0 ? Math.min(100, Math.round(workedMinutes / monthlyTargetMinutes * 100)) : 0} aria-valuetext={`${fmt(workedMinutes)} von ${fmt(monthlyTargetMinutes)} Stunden`} className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-lime-600" style={{ width: `${monthlyTargetMinutes > 0 ? Math.min(100, Math.max(0, workedMinutes / monthlyTargetMinutes * 100)) : 0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Gutschriften
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="font-mono text-2xl font-bold tabular-nums text-palette-blue">
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
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monatssaldo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div
                      className={`font-mono text-2xl font-bold tabular-nums ${balanceMinutes >= 0 ? "text-palette-green" : "text-destructive"}`}
                    >
                      {balanceMinutes >= 0 ? "+" : ""}
                      {fmt(balanceMinutes)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">{fmt(workedMinutes)} + {fmt(creditMinutes)} − {fmt(monthlyTargetMinutes)}</span>
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
                      <div className="flex justify-between gap-4 text-palette-amber">
                        <span>⏰ ÜA-Abbau:</span>
                        <span>{fmt(overtimeReductionMinutes)} (reduziert Saldo)</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-4"><span>Gesamt-Ist:</span><span>{fmt(totalActual)}</span></div>
                    <div className="flex justify-between gap-4 font-medium border-t pt-1">
                      <span>Saldo:</span>
                      <span
                        className={
                          balanceMinutes >= 0 ? "text-palette-green" : "text-destructive"
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

        <Card className="flex flex-col justify-center">
          <CardContent className="space-y-2 p-4">
            <Button variant="default" size="sm" onClick={onCreateEntry} className="w-full rounded-xl text-xs bg-lime-600 text-white hover:bg-lime-700">
              <Plus className="h-4 w-4 mr-2" />
              Eintrag erstellen
            </Button>
            <Button variant="outline" size="sm" onClick={onAddCorrection} className="w-full rounded-xl text-xs">
              <TrendingUp className="h-4 w-4 mr-2" />
              Korrektur hinzufügen
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
