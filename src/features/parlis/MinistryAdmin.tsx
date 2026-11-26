import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { number } from "./documents";

type MinistrySource = Awaited<ReturnType<typeof readMinistries>>["sources"][number];

async function readMinistries(tenantId: string, signal: AbortSignal) {
  const [sources, lines, assignments, links, topics] = await Promise.all([
    supabase.rpc("get_parlis_ministry_sources").abortSignal(signal),
    supabase.from("parlis_ministry_lines").select("id,label").order("label").abortSignal(signal),
    supabase.from("parlis_ministry_assignments").select("legislature,ressort,line_id").eq("tenant_id", tenantId).abortSignal(signal),
    supabase.from("parlis_ministry_topics").select("line_id,topic_id").eq("tenant_id", tenantId).abortSignal(signal),
    supabase.from("topics").select("id,label,is_active").eq("tenant_id", tenantId)
      .is("merged_into", null).order("label").abortSignal(signal),
  ]);
  for (const response of [sources, lines, assignments, links, topics]) if (response.error) throw response.error;
  return {
    sources: sources.data ?? [], lines: lines.data ?? [], assignments: assignments.data ?? [],
    links: links.data ?? [], topics: topics.data ?? [],
  };
}

type Change =
  | { kind: "assign"; source: MinistrySource; lineId: string | null }
  | { kind: "reset"; source: MinistrySource }
  | { kind: "addTopic" | "removeTopic"; lineId: string; topicId: string };

function sourceKey(source: Pick<MinistrySource, "legislature" | "ressort">) {
  return `${source.legislature}:${source.ressort}`;
}

function sourceUrl(source: MinistrySource) {
  return `/daten?${new URLSearchParams({
    bereich: "parlis", wahlperiode: String(source.legislature), ressort: source.ressort,
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
          const { legislature, ressort } = change.source;
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

  const { sources, lines, assignments, links, topics } = query.data;
  const saved = new Map(assignments.map(assignment => [sourceKey(assignment), assignment]));
  const periods = [...new Set(sources.map(source => source.legislature))].sort((a, b) => a - b);
  const sourcesFor = (lineId: string | null) => sources.filter(source => {
    const override = saved.get(sourceKey(source));
    return (override ? override.line_id : source.suggested_line) === lineId;
  });

  function renderSource(source: MinistrySource) {
    const key = sourceKey(source);
    const override = saved.get(key);
    const lineId = override ? override.line_id : source.suggested_line;
    const sharedName = source.suggested_line && sources.some(other =>
      other.legislature !== source.legislature && other.ressort === source.ressort &&
      other.suggested_line === source.suggested_line);
    const status = override ? (lineId ? "Gespeichert" : "Offen gelassen")
      : lineId ? (sharedName ? "Vorschlag · gleicher Name" : "Vorschlag · ähnliche Ressortlinie") : "Ohne Vorschlag";
    return <li key={key} className="min-w-0 space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium [overflow-wrap:anywhere]">{source.ressort}</p>
      <p className="text-xs text-muted-foreground">
        {number.format(source.requests)} {source.requests === 1 ? "Anfrage" : "Anfragen"} · {status}
      </p>
      {source.legislature === 17 || source.legislature === 18 ? <Link className="inline-block text-xs text-primary underline"
        to={sourceUrl(source)}>Vorgänge zum Ressort ansehen</Link> : null}
      <label className="grid gap-1 text-xs font-medium">Ressortlinie
        <select className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm"
          aria-label={`Ressortlinie für ${source.ressort}, ${source.legislature}. Wahlperiode`}
          value={lineId ?? ""} disabled={mutation.isPending}
          onChange={event => mutation.mutate({ kind: "assign", source, lineId: event.target.value || null })}>
          <option value="">Ohne Zuordnung</option>
          {lines.map(line => <option key={line.id} value={line.id}>{line.label}</option>)}
        </select>
      </label>
      {!override && lineId && <Button size="sm" variant="outline" disabled={mutation.isPending}
        onClick={() => mutation.mutate({ kind: "assign", source, lineId })}>Vorschlag übernehmen</Button>}
      {override && <Button size="sm" variant="ghost" disabled={mutation.isPending}
        onClick={() => mutation.mutate({ kind: "reset", source })}>Auf Vorschlag zurücksetzen</Button>}
    </li>;
  }

  function renderPeriods(lineSources: MinistrySource[]) {
    return <div className="grid gap-4 md:grid-cols-2">
      {periods.map(period => {
        const periodSources = lineSources.filter(source => source.legislature === period);
        return <section key={period} className="min-w-0 space-y-2">
          <h4 className="text-sm font-medium">{period}. Wahlperiode</h4>
          {periodSources.length ? <ul className="space-y-2">{periodSources.map(renderSource)}</ul>
            : <p className="text-sm text-muted-foreground">Keine Ressorts zugeordnet.</p>}
        </section>;
      })}
    </div>;
  }

  return <section className="space-y-4">
    <header className="space-y-1">
      <h2 className="text-2xl font-semibold">Ministerien und Themen</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">
        PARLIS-Ressorts nach Wahlperiode vergleichen und Ressortlinien mit zentralen Themen dieses Arbeitsbereichs verknüpfen.
        Zuständigkeiten können sich zwischen den Wahlperioden ändern.
      </p>
    </header>
    {mutation.isError && <p role="alert" className="text-sm text-destructive">Die Änderung konnte nicht gespeichert werden.</p>}
    {mutation.isPending && <p role="status" className="text-sm">Änderung wird gespeichert …</p>}
    {!sources.length && <p className="text-sm text-muted-foreground">In PARLIS sind keine Ministerien erfasst.</p>}
    {lines.map(line => {
      const lineSources = sourcesFor(line.id);
      const linkedIds = links.filter(link => link.line_id === line.id).map(link => link.topic_id);
      const choices = topics.filter(topic => topic.is_active && !linkedIds.includes(topic.id));
      const selection = topicSelections[line.id] ?? "";
      return <Card key={line.id}>
        <CardHeader><CardTitle className="text-lg">{line.label}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {renderPeriods(lineSources)}
          <div className="space-y-2 border-t pt-3">
            <h4 className="text-sm font-medium">Zentrale Themen</h4>
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
          </div>
        </CardContent>
      </Card>;
    })}
    {!!sourcesFor(null).length && <Card>
      <CardHeader><CardTitle className="text-lg">Nicht zugeordnete Ressorts</CardTitle></CardHeader>
      <CardContent>{renderPeriods(sourcesFor(null))}</CardContent>
    </Card>}
  </section>;
}
