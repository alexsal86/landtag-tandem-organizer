import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dimensions, groupsFor, type Dimension } from "./grouping";
import { supabase } from "@/integrations/supabase/client";

const pageSize = 20;
const number = new Intl.NumberFormat("de-DE");
const month = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

async function loadProceedings(signal: AbortSignal) {
  const fetchPage = (offset: number) => supabase
    .from("parlis_proceedings")
    .select("vorgangs_id, drucksache, vorgangstyp, datum, urheber, ressort, titel, deskriptoren, pdf_url, dokument_url")
    .eq("legislature", 18)
    .order("datum", { ascending: false })
    .order("vorgangs_id")
    .range(offset, offset + 499)
    .abortSignal(signal);

  const first = await fetchPage(0);
  if (first.error) throw first.error;
  const proceedings = first.data;
  for (let offset = proceedings.length; offset > 0 && offset % 500 === 0; offset = proceedings.length) {
    const next = await fetchPage(offset);
    if (next.error) throw next.error;
    if (!next.data.length) break;
    proceedings.push(...next.data);
  }
  return proceedings;
}

type Proceeding = Awaited<ReturnType<typeof loadProceedings>>[number];

function groupLabel(key: string, dimension: Dimension) {
  return dimension === "datum" ? month.format(new Date(key + "-01T00:00:00Z")) : key;
}

function documentLink(row: Proceeding) {
  return [row.pdf_url, row.dokument_url].find(url => /^https:\/\/www\.landtag-bw\.de\//i.test(url));
}

export default function ParlisView() {
  const query = useQuery({
    queryKey: ["parlis-proceedings", 18],
    queryFn: ({ signal }) => loadProceedings(signal),
    staleTime: 5 * 60 * 1000,
  });
  const [search, setSearch] = useState("");
  const [dimension, setDimension] = useState<Dimension>("datum");
  const [selected, setSelected] = useState<string | null>(null);
  const [visible, setVisible] = useState(pageSize);

  const matches = useMemo(() => {
    const terms = search.trim().toLocaleLowerCase("de-DE").split(/\s+/).filter(Boolean);
    return (query.data ?? []).filter(row => {
      const searchable = [row.titel, row.drucksache, row.vorgangs_id, row.vorgangstyp, row.urheber, row.ressort, row.deskriptoren, row.datum]
        .join(" ").toLocaleLowerCase("de-DE");
      return terms.every(term => searchable.includes(term));
    });
  }, [query.data, search]);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of matches) {
      for (const key of groupsFor(row, dimension)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts].sort(([a, countA], [b, countB]) =>
      (dimension === "datum" ? 0 : countB - countA) || a.localeCompare(b, "de-DE"));
  }, [dimension, matches]);
  const chartGroups = dimension === "datum" ? groups : groups.slice(0, 12);
  const max = Math.max(1, ...chartGroups.map(([, count]) => count));
  const filtered = selected === null ? matches : matches.filter(row => groupsFor(row, dimension).includes(selected));

  useEffect(() => {
    if (selected !== null && !groups.some(([key]) => key === selected)) setSelected(null);
  }, [groups, selected]);

  if (query.isPending) return <p role="status">Parlamentarische Vorgänge werden geladen …</p>;
  if (query.isError) return (
    <div className="space-y-3" role="alert">
      <p>Die parlamentarischen Vorgänge konnten nicht geladen werden.</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Erneut laden</Button>
    </div>
  );

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Parlamentarische Vorgänge</h1>
        <p className="text-muted-foreground">Landtag Baden-Württemberg · 18. Wahlperiode</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Suche
          <Input type="search" value={search} placeholder="Titel, Schlagwort, Drucksache …" onChange={event => {
            setSearch(event.target.value);
            setSelected(null);
            setVisible(pageSize);
          }} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Gruppieren nach
          <select className="h-10 rounded-md border border-input bg-background px-3" value={dimension} onChange={event => {
            setDimension(event.target.value as Dimension);
            setSelected(null);
            setVisible(pageSize);
          }}>
            {Object.entries(dimensions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </div>
      {chartGroups.length > 0 && (
        <div className="space-y-2 rounded-lg border p-4" role="group" aria-label="Vorgänge je Gruppe">
          <p className="text-sm text-muted-foreground">
            {groups.length > chartGroups.length && "12 häufigste Gruppen · "}
            {dimension === "deskriptoren" && "Mehrere Schlagwörter pro Vorgang möglich · "}
            Balken auswählen, um die Treffer einzugrenzen
          </p>
          {chartGroups.map(([key, count]) => (
            <button key={key} type="button" aria-pressed={selected === key}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 rounded-md px-2 py-1 text-left text-sm hover:bg-muted aria-pressed:bg-accent"
              onClick={() => {
                setSelected(selected === key ? null : key);
                setVisible(pageSize);
              }}>
              <span className="break-words">{groupLabel(key, dimension)}</span>
              <span className="tabular-nums">{number.format(count)}</span>
              <span className="col-span-2 h-1.5 rounded-full bg-muted" aria-hidden="true">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${count / max * 100}%` }} />
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold" aria-live="polite">
          {number.format(filtered.length)} von {number.format(query.data.length)} Vorgängen
          {selected !== null && ` · ${groupLabel(selected, dimension)}`}
        </h2>
        {!filtered.length && <p className="text-muted-foreground">Keine Vorgänge gefunden.</p>}
        <ul className="divide-y">
          {filtered.slice(0, visible).map(row => {
            const url = documentLink(row);
            return (
              <li key={row.vorgangs_id} className="space-y-1 py-3">
                <h3 className="font-medium">{row.titel || row.vorgangs_id}</h3>
                <p className="text-sm text-muted-foreground">
                  {[row.datum.split("-").reverse().join("."), row.vorgangstyp, row.drucksache, row.urheber, row.ressort].filter(Boolean).join(" · ")}
                </p>
                {row.deskriptoren && <p className="text-sm">{row.deskriptoren}</p>}
                {url && <a className="inline-block text-sm text-primary underline" href={url} target="_blank" rel="noreferrer">Originaldokument öffnen</a>}
              </li>
            );
          })}
        </ul>
        {visible < filtered.length && (
          <Button variant="outline" onClick={() => setVisible(visible + pageSize)}>Weitere Vorgänge anzeigen</Button>
        )}
      </div>
    </section>
  );
}
