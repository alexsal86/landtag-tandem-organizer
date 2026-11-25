import { useMemo, useState } from "react";
import { Activity, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { readReports } from "@/features/selftest/reports";
import { PULSE_AREAS, areaLevel, type PulseLevel } from "./pulse";

interface Props { gaps: Array<{ table_name: string; severity: string }> }

const dot: Record<PulseLevel, string> = { green: "bg-palette-green", yellow: "bg-warning", red: "bg-destructive", grey: "bg-muted-foreground/40" };
const text: Record<PulseLevel, string> = { green: "Alles in Ordnung", yellow: "Prüfen", red: "Fehler", grey: "Noch nie getestet" };

export function SystemPulse({ gaps }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);

  const input = useMemo(() => {
    const runs: Record<string, string> = {};
    for (const r of readReports(currentTenant?.id ?? "", user?.id ?? "")) if (!runs[r.scenarioId]) runs[r.scenarioId] = r.status;
    return {
      runs,
      criticalTables: new Set(gaps.filter((g) => g.severity === "critical").map((g) => g.table_name)),
      warningTables: new Set(gaps.filter((g) => g.severity === "warning").map((g) => g.table_name)),
    };
  }, [gaps, currentTenant?.id, user?.id]);

  const levels = PULSE_AREAS.map((a) => ({ area: a, level: areaLevel(a, input) }));
  const count = (l: PulseLevel) => levels.filter((x) => x.level === l).length;
  const selected = levels.find((x) => x.area.id === open);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> System-Puls</CardTitle>
        <CardDescription>
          {count("green")} grün · {count("yellow")} prüfen · {count("red")} Fehler · {count("grey")} ungetestet — aus deinen letzten Selbsttests und der Sicherheitsprüfung.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {levels.map(({ area, level }) => (
            <button key={area.id} type="button" onClick={() => setOpen(open === area.id ? null : area.id)}
              className={cn("rounded-lg border p-3 text-left transition-colors hover:bg-muted", open === area.id && "ring-2 ring-ring")}>
              <div className="flex items-center gap-2">
                <span aria-hidden className={cn("h-3 w-3 rounded-full", dot[level])} />
                <span className="font-medium">{area.title}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{text[level]}</div>
              {area.next.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  <ArrowRight className="h-3 w-3" />{area.next.map((n) => PULSE_AREAS.find((a) => a.id === n)?.title).join(", ")}
                </div>
              )}
            </button>
          ))}
        </div>
        {selected && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
            <div className="font-medium">{selected.area.title}: {text[selected.level]}</div>
            <ul className="space-y-1">
              {selected.area.scenarios.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span aria-hidden className={cn("h-2 w-2 rounded-full", dot[input.runs[s] === "ok" ? "green" : input.runs[s] === "failed" ? "red" : input.runs[s] ? "yellow" : "grey"])} />
                  Test „{s}“: {input.runs[s] === "ok" ? "bestanden" : input.runs[s] === "failed" ? "fehlgeschlagen" : input.runs[s] ?? "noch nie gelaufen"}
                </li>
              ))}
            </ul>
            <Button size="sm" onClick={() => navigate("/selbsttest")}>Selbsttests öffnen</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
