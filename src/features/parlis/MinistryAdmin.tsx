import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { number } from "./documents";
import {
  currentLegislature, knownLegislatures, ministriesForLegislature, periodYears,
  type ElectionPeriodRow, type MinistrySourceRow, type MinistrySuggestionRow,
} from "./ministryAdminModel";

// Die Zeilentypen stehen hier ausdrücklich: der Query-Wrapper liefert die
// Antworten ohne generische Bindung, sonst bleibt `data` unknown und jede
// Ableitung daraus (Wahlperioden, Zuordnungen) verliert ihren Typ.
type MinistryLine = { id: string; label: string };
type MinistryAssignment = { legislature: number; ressort: string; line_id: string | null };
type MinistryLink = { line_id: string; topic_id: string };
type MinistryTopic = { id: string; label: string; is_active: boolean };
type MinistryData = {
  sources: MinistrySourceRow[]; lines: MinistryLine[]; assignments: MinistryAssignment[];
  links: MinistryLink[]; topics: MinistryTopic[]; suggestions: MinistrySuggestionRow[];
  periods: ElectionPeriodRow[];
};

async function readMinistries(tenantId: string, signal: AbortSignal): Promise<MinistryData> {
  const [sources, lines, assignments, links, topics, suggestions, periods] = await Promise.all([
    supabase.rpc("get_parlis_ministry_sources").abortSignal(signal),
    supabase.from("parlis_ministry_lines").select("id,label").order("label").abortSignal(signal),
    supabase.from("parlis_ministry_assignments").select("legislature,ressort,line_id").eq("tenant_id", tenantId).abortSignal(signal),
    supabase.from("parlis_ministry_topics").select("line_id,topic_id").eq("tenant_id", tenantId).abortSignal(signal),
    supabase.from("topics").select("id,label,is_active").eq("tenant_id", tenantId)
      .is("merged_into", null).order("label").abortSignal(signal),
    supabase.from("parlis_ministry_suggestions").select("legislature,ressort,line_id").abortSignal(signal),
    supabase.from("election_history_periods").select("number,starts_on,ends_on,is_current")
      .order("number", { ascending: false }).abortSignal(signal),
  ]);
  for (const response of [sources, lines, assignments, links, topics, suggestions]) if (response.error) throw response.error;
  // Die Wahlperioden sind nur eine Orientierung. Ohne Leserecht bleibt die
  // höchste in PARLIS belegte Wahlperiode die laufende.
  return {
    sources: (sources.data ?? []) as MinistrySourceRow[], lines: (lines.data ?? []) as MinistryLine[],
    assignments: (assignments.data ?? []) as MinistryAssignment[], links: (links.data ?? []) as MinistryLink[],
    topics: (topics.data ?? []) as MinistryTopic[],
    suggestions: (suggestions.data ?? []) as MinistrySuggestionRow[],
    periods: (periods.error ? [] : periods.data ?? []) as ElectionPeriodRow[],
  };
}

type Change =
  | { kind: "assign"; legislature: number; ressort: string; lineId: string | null }
  | { kind: "reset"; legislature: number; ressort: string }
  | { kind: "addTopic" | "removeTopic"; lineId: string; topicId: string };

function sourceKey(legislature: number, ressort: string) {
  return `${legislature}:${ressort}`;
}

function sourceUrl(legislature: number, ressort: string) {
  return `/daten?${new URLSearchParams({
    bereich: "parlis", wahlperiode: String(legislature), ressort,
  })}`;
}

export default function MinistryAdmin({ tenantId }: { tenantId: string }) {
  const client = useQueryClient();
  const queryKey = ["parlis-ministry-administration", tenantId];
  const query = useQuery({ queryKey, queryFn: ({ signal }) => readMinistries(tenantId, signal) });
  const mutation = useMutation({
    mutationFn: async (change: Change) => {
      switch (change.kind) {
        case "assign":
        case "reset": {
          const { legislature, ressort } = change;
          const table = supabase.from("parlis_ministry_assignments");
          const response = change.kind === "assign"
            ? await table.upsert({ tenant_id: tenantId, legislature, ressort, line_id: change.lineId })
            : await table.delete().eq("tenant_id", tenantId).eq("legislature", legislature).eq("ressort", ressort);
          if (response.error) throw response.error;
          break;
        }
        case "addTopic":
        case "removeTopic": {
          const table = supabase.from("parlis_ministry_topics");
          const response = change.kind === "addTopic"
            ? await table.upsert({ tenant_id: tenantId, line_id: change.lineId, topic_id: change.topicId }, { ignoreDuplicates: true })
            : await table.delete().eq("tenant_id", tenantId).eq("line_id", change.lineId).eq("topic_id", change.topicId);
          if (response.error) throw response.error;
        }
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
  const [topicSelections, setTopicSelections] = useState<Record<string, string>>({});

  if (query.isPending) return <p role="status">Ministerien werden geladen …</p>;
  if (query.isError) return <div role="alert" className="space-y-2">
    <p>Ministerien und Themen konnten nicht geladen werden.</p>
    <Button variant="outline" onClick={() => void query.refetch()}>Erneut laden</Button>
  </div>;

  const { sources, lines, assignments, links, topics, suggestions, periods } = query.data;
  const saved = new Map(assignments.map(assignment => [sourceKey(assignment.legislature, assignment.ressort), assignment]));
  const current = currentLegislature(periods, sources);
  const currentNumber = current ?? 0;
  const currentPeriod = periods.find(period => period.number === current) ?? null;
  const currentMinistries = current === null ? [] : ministriesForLegislature(current, sources, suggestions);
  const pastPeriods = knownLegislatures(sources, suggestions).filter(number => number !== current).sort((a, b) => b - a);
  const lineLabel = (lineId: string | null) => lines.find(line => line.id === lineId)?.label ?? "Keine Ressortlinie";

  function lineOf(legislature: number, ressort: string, suggestedLine: string | null) {
    const override = saved.get(sourceKey(legislature, ressort));
    return override ? override.line_id : suggestedLine;
  }

  const usedLines = lines.filter(line =>
    current !== null && currentMinistries.some(ministry => lineOf(currentNumber, ministry.ressort, ministry.suggestedLine) === line.id));

  function renderMinistry(legislature: number, ressort: string, requests: number, suggestedLine: string | null) {
    const override = saved.get(sourceKey(legislature, ressort));
    const lineId = override ? override.line_id : suggestedLine;
    const status = override ? (lineId ? "Gespeichert" : "Offen gelassen")
      : lineId ? "Vorschlag" : "Ohne Vorschlag";
    return <li key={sourceKey(legislature, ressort)} className="min-w-0 space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium [overflow-wrap:anywhere]">{ressort}</p>
        <p className="text-xs text-muted-foreground">
          {number.format(requests)} {requests === 1 ? "Anfrage" : "Anfragen"}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{lineLabel(lineId)} · {status}</p>
      {legislature === 17 || legislature === 18 ? <Link className="inline-block text-xs text-primary underline"
        to={sourceUrl(legislature, ressort)}>Vorgänge zum Ressort ansehen</Link> : null}
      <label className="grid gap-1 text-xs font-medium">Ressortlinie
        <select className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm"
          aria-label={`Ressortlinie für ${ressort}, ${legislature}. Wahlperiode`}
          value={lineId ?? ""} disabled={mutation.isPending}
          onChange={event => mutation.mutate({ kind: "assign", legislature, ressort, lineId: event.target.value || null })}>
          <option value="">Ohne Zuordnung</option>
          {lines.map(line => <option key={line.id} value={line.id}>{line.label}</option>)}
        </select>
      </label>
      {!override && lineId && <Button size="sm" variant="outline" disabled={mutation.isPending}
        onClick={() => mutation.mutate({ kind: "assign", legislature, ressort, lineId })}>Vorschlag übernehmen</Button>}
      {override && <Button size="sm" variant="ghost" disabled={mutation.isPending}
        onClick={() => mutation.mutate({ kind: "reset", legislature, ressort })}>Auf Vorschlag zurücksetzen</Button>}
    </li>;
  }

  function renderPeriodHeading(legislature: number) {
    const period = periods.find(item => item.number === legislature) ?? null;
    const years = periodYears(period);
    return <h4 className="text-sm font-medium">
      {legislature}. Wahlperiode{years ? ` · ${years}` : ""}
    </h4>;
  }

  return <section className="space-y-4">
    <header className="space-y-1">
      <h2 className="text-2xl font-semibold">Ministerien und Themen</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Ordnet die Ministerien der laufenden Wahlperiode den Ressortlinien dieses Arbeitsbereichs zu und pflegt je Ressortlinie
        die zentralen Themen. Frühere Wahlperioden bleiben als Zuordnungsarchiv erreichbar; die Namens- und Ministerhistorie
        steht im Super-Admin-Bereich.
      </p>
    </header>
    {mutation.isError && <p role="alert" className="text-sm text-destructive">Die Änderung konnte nicht gespeichert werden.</p>}
    {mutation.isPending && <p role="status" className="text-sm">Änderung wird gespeichert …</p>}
    {!sources.length && !suggestions.length && <p className="text-sm text-muted-foreground">In PARLIS sind keine Ministerien erfasst.</p>}

    {current !== null && <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg">Ministerien der {current}. Wahlperiode</CardTitle>
        <p className="text-xs text-muted-foreground">
          {periodYears(currentPeriod) ?? "Zeitraum nicht hinterlegt"}
          {currentPeriod?.is_current ? " · von den Wahldaten als aktuell markiert"
            : currentPeriod ? " · laufende Periode laut Wahldaten" : " · höchste belegte Wahlperiode"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!currentMinistries.length && <p className="text-sm text-muted-foreground">
          Für diese Wahlperiode sind keine Ministerien hinterlegt.
        </p>}
        <ul className="grid gap-2 md:grid-cols-2">
          {currentMinistries.map(ministry =>
            renderMinistry(currentNumber, ministry.ressort, ministry.requests, ministry.suggestedLine))}
        </ul>
      </CardContent>
    </Card>}

    {current !== null && <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg">Zentrale Themen der laufenden Ministerien</CardTitle>
        <p className="text-xs text-muted-foreground">
          Themen hängen an der Ressortlinie, nicht an der Wahlperiode: Eine Zuordnung hier gilt für alle Ministerien dieser Linie.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!usedLines.length && <p className="text-sm text-muted-foreground">
          Noch keine Ressortlinie zugeordnet – zentrale Themen lassen sich danach pflegen.
        </p>}
        <div className="grid gap-3 md:grid-cols-2">
          {usedLines.map(line => {
            const lineSources = currentMinistries.filter(ministry =>
              lineOf(currentNumber, ministry.ressort, ministry.suggestedLine) === line.id);
            const linkedIds = links.filter(link => link.line_id === line.id).map(link => link.topic_id);
            const choices = topics.filter(topic => topic.is_active && !linkedIds.includes(topic.id));
            const selection = topicSelections[line.id] ?? "";
            return <section key={line.id} className="min-w-0 space-y-2 rounded-md border p-3">
              <h3 className="text-sm font-semibold">{line.label}</h3>
              <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {lineSources.map(ministry => ministry.ressort).join(" · ")}
              </p>
              {linkedIds.length > 0 && <ul className="flex flex-wrap gap-2">
                {linkedIds.map(topicId => {
                  const label = topics.find(topic => topic.id === topicId)?.label ?? "Thema";
                  return <li key={topicId}>
                    <Button variant="secondary" size="sm" aria-label={`${label} von ${line.label} entfernen`}
                      disabled={mutation.isPending} onClick={() => mutation.mutate({ kind: "removeTopic", lineId: line.id, topicId })}>
                      {label} <span aria-hidden="true">×</span>
                    </Button>
                  </li>;
                })}
              </ul>}
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid min-w-0 max-w-full gap-1 text-xs font-medium">Thema hinzufügen
                  <select className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm"
                    aria-label={`Zentrales Thema für ${line.label}`} value={selection}
                    disabled={!choices.length || mutation.isPending}
                    onChange={event => setTopicSelections(current => ({ ...current, [line.id]: event.target.value }))}>
                    <option value="">{choices.length ? "Thema auswählen" : "Keine weiteren aktiven Themen"}</option>
                    {choices.map(topic => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
                  </select>
                </label>
                <Button size="sm" disabled={!selection || mutation.isPending || !choices.some(topic => topic.id === selection)}
                  onClick={() => mutation.mutate({ kind: "addTopic", lineId: line.id, topicId: selection }, {
                    onSuccess: () => setTopicSelections(current => ({ ...current, [line.id]: "" })),
                  })}>Verknüpfen</Button>
              </div>
            </section>;
          })}
        </div>
      </CardContent>
    </Card>}

    {pastPeriods.length > 0 && <details className="rounded-md border bg-muted/20 p-3">
      <summary className="cursor-pointer text-sm font-medium">Frühere Wahlperioden ({pastPeriods.length})</summary>
      <p className="mt-1 text-xs text-muted-foreground">
        Nur die Zuordnung zu den Ressortlinien. Die Darstellung, wie sich die Ministerien seit 1952 benannt haben,
        befindet sich im Super-Admin-Bereich unter „Ministerien-Historie“.
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {pastPeriods.map(legislature => {
          const ministries = ministriesForLegislature(legislature, sources, suggestions);
          return <section key={legislature} className="min-w-0 space-y-2">
            {renderPeriodHeading(legislature)}
            {ministries.length ? <ul className="space-y-2">
              {ministries.map(ministry =>
                renderMinistry(legislature, ministry.ressort, ministry.requests, ministry.suggestedLine))}
            </ul> : <p className="text-sm text-muted-foreground">Keine Ministerien erfasst.</p>}
          </section>;
        })}
      </div>
    </details>}
  </section>;
}
