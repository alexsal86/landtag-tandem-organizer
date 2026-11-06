import { useEffect, useState } from "react";
import { compareRuns, loadHistory, type HistoryRun } from "../history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SharedRunHistory({ tenantId, refreshKey }: { tenantId: string; refreshKey: string }) {
  const [history, setHistory] = useState<HistoryRun[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setHistory([]); setError(false);
    loadHistory(tenantId).then(rows => { if (active) setHistory(rows); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [tenantId, refreshKey]);
  return <Card><CardHeader><CardTitle>Gemeinsamer Verlauf im Büro</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
    {error ? <p>Gemeinsamer Verlauf konnte nicht geladen werden. Lokale Berichte bleiben verfügbar.</p> : history.length === 0 ? <p>Noch keine gemeinsamen Läufe gespeichert.</p> : history.slice(0, 60).map(run => {
      const previous = history.find(r => r.scenario_id === run.scenario_id && r.created_at < run.created_at);
      const diff = previous ? compareRuns(previous.steps, run.steps) : null;
      return <details key={run.id}><summary className="cursor-pointer">{run.scenario_title} · {run.status} · {new Date(run.created_at).toLocaleString("de-DE")}{diff ? ` · ${diff.fixed.length} behoben / ${diff.broken.length} neue Fehler` : ""}</summary>
        <ul>{run.steps.map(step => <li key={step.id} className="py-1">{step.label}: {step.status} {step.message}{step.details !== undefined && <pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(step.details, null, 2)}</pre>}</li>)}</ul>
      </details>;
    })}
  </CardContent></Card>;
}
