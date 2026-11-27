import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import {
  emptyPromiseHintStats, promiseHintsWithoutFeedback, type PromiseHintStats,
} from "./officeFeedbackPromiseHintStats";

interface HintTotals extends PromiseHintStats {
  users: number;
}

const numberFormat = new Intl.NumberFormat("de-DE");

/**
 * Superadmin-Readout der Zusagen-Messung: Summen über alle Nutzer, ohne Gesprächsinhalt.
 * Die Daten kommen aus `get_office_feedback_promise_hint_stats` (nur Superadmins).
 */
export function PromiseHintStatsReadout(): React.JSX.Element {
  const [totals, setTotals] = useState<HintTotals | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc("get_office_feedback_promise_hint_stats");
      if (cancelled) return;
      if (error) {
        debugConsole.error("Zusagen-Messung: Summe nicht ladbar", error);
        setFailed(true);
        return;
      }
      const row = (Array.isArray(data) ? data[0] : data) as Partial<Record<keyof HintTotals, number>> | null;
      setTotals({
        shown: Number(row?.shown ?? 0),
        unchanged: Number(row?.unchanged ?? 0),
        edited: Number(row?.edited ?? 0),
        discarded: Number(row?.discarded ?? 0),
        users: Number(row?.users ?? 0),
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = totals
    ? ([
      ["Erschienen", totals.shown],
      ["Unverändert gesendet", totals.unchanged],
      ["Geändert", totals.edited],
      ["Verworfen", totals.discarded],
      ["Ohne Rückmeldung", promiseHintsWithoutFeedback(totals)],
    ] as const)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Zusagen-Hinweis: wie er ankommt</CardTitle>
        <CardDescription>
          Summe über alle Nutzer, nur Anzahlen – kein Gesprächsinhalt. Trefferquote gegen „Erschienen" rechnen;
          „Ohne Rückmeldung" sind erschienene Vorschläge, zu denen nie eine Rückmeldung gesendet wurde.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {failed ? (
          <p className="text-sm text-muted-foreground">Zähler konnten nicht geladen werden.</p>
        ) : !totals ? (
          <p className="text-sm text-muted-foreground">Lade Zähler …</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {rows.map(([label, value]) => (
                <div key={label} className="rounded-xl border p-3">
                  <dt className="text-meta text-muted-foreground">{label}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{numberFormat.format(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-meta text-muted-foreground">
              {numberFormat.format(totals.users)} Nutzer mit gespeicherter Messung.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
