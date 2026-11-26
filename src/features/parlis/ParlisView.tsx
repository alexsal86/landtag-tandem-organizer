import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Search } from "lucide-react";
import { DocumentCard, DocumentDateGroup } from "./DocumentCard";
import { dateGroups, documentCount, documentParties, keywords, number } from "./documents";
import "./parlis.css";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dimensions, groupsFor, type Dimension } from "./grouping";
import { supabase } from "@/integrations/supabase/client";

const pageSize = 20;
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

async function loadDeputyProfiles(signal: AbortSignal) {
  const profiles: { proceedingId: string; name: string; key: string }[] = [];
  const batchSize = 500;
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await supabase.from("parlis_deputy_profiles")
      .select("vorgangs_id, deputy_name, profile_key")
      .eq("legislature", 18)
      .order("vorgangs_id")
      .order("mandate_id")
      .range(offset, offset + batchSize - 1)
      .abortSignal(signal);
    if (error) throw error;
    for (const row of data) {
      if (row.vorgangs_id && row.deputy_name && row.profile_key) {
        profiles.push({ proceedingId: row.vorgangs_id, name: row.deputy_name, key: row.profile_key });
      }
    }
    if (data.length < batchSize) return profiles;
  }
}

function groupLabel(key: string, dimension: Dimension) {
  return dimension === "datum" ? month.format(new Date(key + "-01T00:00:00Z")) : key;
}

const emptyFilters = { kind: "", party: "", from: "", to: "", topic: "" };

export default function ParlisView() {
  const query = useQuery({
    queryKey: ["parlis-proceedings", 18],
    queryFn: ({ signal }) => loadProceedings(signal),
    staleTime: 5 * 60 * 1000,
  });
  const profiles = useQuery({
    queryKey: ["parlis-deputy-profiles", 18],
    queryFn: ({ signal }) => loadDeputyProfiles(signal),
    staleTime: 5 * 60 * 1000,
  });
  const [params, setParams] = useSearchParams();
  const deputyKey = params.get("urheber");
  const profileByProceeding = useMemo(() => {
    const index = new Map<string, Map<string, string>>();
    for (const { proceedingId, key, name } of profiles.data ?? []) {
      const authors = index.get(proceedingId) ?? new Map<string, string>();
      authors.set(key, name);
      index.set(proceedingId, authors);
    }
    return index;
  }, [profiles.data]);
  const deputyName = profiles.data?.find(profile => profile.key === deputyKey)?.name;
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [oldestFirst, setOldestFirst] = useState(false);
  const [dimension, setDimension] = useState<Dimension>("datum");
  const [selected, setSelected] = useState<string | null>(null);
  const [visible, setVisible] = useState(pageSize);

  const indexed = useMemo(() => (query.data ?? []).map(row => ({
    row,
    parties: documentParties(row.urheber),
    topics: keywords(row.deskriptoren),
    text: [row.titel, row.drucksache, row.vorgangs_id, row.vorgangstyp, row.urheber, row.ressort, row.deskriptoren, row.datum]
      .join(" ").toLocaleLowerCase("de-DE"),
  })), [query.data]);
  const options = useMemo(() => {
    const sorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "de-DE"));
    return {
      kinds: sorted(indexed.map(({ row }) => row.vorgangstyp)),
      parties: sorted(indexed.flatMap(({ parties }) => parties)),
      topics: sorted(indexed.flatMap(({ topics }) => topics)),
    };
  }, [indexed]);
  const hasFilters = !!(search || selected || deputyKey || oldestFirst || Object.values(filters).some(Boolean));

  function resetResultWindow() {
    setSelected(null);
    setVisible(pageSize);
  }

  function updateFilter(key: keyof typeof emptyFilters, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
    resetResultWindow();
  }

  function clearDeputy() {
    const next = new URLSearchParams(params);
    next.delete("urheber");
    setParams(next);
    resetResultWindow();
  }

  const matches = useMemo(() => {
    const terms = search.trim().toLocaleLowerCase("de-DE").split(/\s+/).filter(Boolean);
    return indexed.filter(({ row, parties, topics, text }) =>
      (!deputyKey || profileByProceeding.get(row.vorgangs_id)?.has(deputyKey)) &&
      (!filters.kind || row.vorgangstyp === filters.kind) &&
      (!filters.party || (filters.party === "__unknown" ? !parties.length : parties.includes(filters.party))) &&
      (!filters.from || row.datum >= filters.from) &&
      (!filters.to || row.datum <= filters.to) &&
      (!filters.topic || topics.includes(filters.topic)) &&
      terms.every(term => text.includes(term))
    ).map(({ row }) => row);
  }, [indexed, search, deputyKey, profileByProceeding, filters]);

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
  const filtered = useMemo(() => {
    const rows = selected === null ? [...matches] : matches.filter(row => groupsFor(row, dimension).includes(selected));
    return rows.sort((a, b) => (oldestFirst ? a.datum.localeCompare(b.datum) : b.datum.localeCompare(a.datum))
      || a.vorgangs_id.localeCompare(b.vorgangs_id));
  }, [matches, selected, dimension, oldestFirst]);
  const days = dateGroups(filtered, visible);

  useEffect(() => {
    if (selected !== null && !groups.some(([key]) => key === selected)) setSelected(null);
  }, [groups, selected]);

  if (query.isPending || (deputyKey && profiles.isPending)) return <p role="status">Parlamentarische Vorgänge werden geladen …</p>;
  if (query.isError) return (
    <div className="space-y-3" role="alert">
      <p>Die parlamentarischen Vorgänge konnten nicht geladen werden.</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Erneut laden</Button>
    </div>
  );

  return (
    <section className="parlis-page">
      <div className="parlis-content">
        <header className="parlis-heading">
          <h1>Parlamentarische Vorgänge</h1>
          <p>Landtag Baden-Württemberg · 18. Wahlperiode</p>
        </header>
        {profiles.isError && <p role="alert">Abgeordnetenverknüpfungen konnten nicht geladen werden.{" "}
          <Button variant="link" onClick={() => void profiles.refetch()}>Erneut laden</Button>
        </p>}
        <section className="parlis-filters" aria-label="Dokumente suchen und filtern">
          <label className="parlis-search">
            <span className="sr-only">Dokumente suchen</span>
            <Search size={18} aria-hidden="true" />
            <Input type="search" value={search} placeholder="Titel, Schlagwort, Drucksache …" onChange={event => {
              setSearch(event.target.value);
              resetResultWindow();
            }} />
          </label>
          <div className="parlis-filter-grid">
            <label>Dokumententyp<select aria-label="Dokumententyp" value={filters.kind} onChange={event => updateFilter("kind", event.target.value)}>
              <option value="">Alle Typen</option>
              {options.kinds.map(kind => <option key={kind}>{kind}</option>)}
            </select></label>
            <label>Fraktion<select aria-label="Fraktion" value={filters.party} onChange={event => updateFilter("party", event.target.value)}>
              <option value="">Alle Fraktionen</option>
              {options.parties.map(party => <option key={party}>{party}</option>)}
              <option value="__unknown">Ohne Fraktionsangabe</option>
            </select></label>
            <label>Schlagwort<select aria-label="Schlagwort" value={filters.topic} onChange={event => updateFilter("topic", event.target.value)}>
              <option value="">Alle Schlagwörter</option>
              {options.topics.map(topic => <option key={topic}>{topic}</option>)}
            </select></label>
            <label>Datum von<Input type="date" value={filters.from} max={filters.to || undefined} onChange={event => updateFilter("from", event.target.value)} /></label>
            <label>Datum bis<Input type="date" value={filters.to} min={filters.from || undefined} onChange={event => updateFilter("to", event.target.value)} /></label>
            <label>Sortierung<select aria-label="Sortierung" value={oldestFirst ? "asc" : "desc"} onChange={event => {
              setOldestFirst(event.target.value === "asc");
              setVisible(pageSize);
            }}>
              <option value="desc">Neueste zuerst</option>
              <option value="asc">Älteste zuerst</option>
            </select></label>
          </div>
          <div className="parlis-filter-footer">
            {deputyKey && <Button variant="outline" size="sm" onClick={clearDeputy}>
              {deputyName || "Ausgewähltes Abgeordnetenprofil"} · Auswahl entfernen
            </Button>}
            {hasFilters && <Button variant="ghost" size="sm" onClick={() => {
              setSearch("");
              setFilters(emptyFilters);
              setOldestFirst(false);
              if (deputyKey) clearDeputy();
              else resetResultWindow();
            }}>Filter zurücksetzen</Button>}
          </div>
        </section>
        <details className="parlis-analysis">
          <summary>Auswertung <ChevronDown size={16} aria-hidden="true" /></summary>
          <label>Gruppieren nach
            <select aria-label="Gruppieren nach" value={dimension} onChange={event => {
              setDimension(event.target.value as Dimension);
              resetResultWindow();
            }}>
              {Object.entries(dimensions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
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
        </details>
        <section className="parlis-results" aria-label="Dokumente">
          <h2 aria-live="polite">
            {documentCount(filtered.length)} <span>von {number.format(query.data.length)}</span>
            {selected !== null && <span> · {groupLabel(selected, dimension)}</span>}
          </h2>
          {!filtered.length && <p className="parlis-empty">Keine Vorgänge gefunden.</p>}
          {days.map(([date, day]) => <DocumentDateGroup key={date} date={date} count={day.count}>
            {day.rows.map(row => <li key={row.vorgangs_id}>
              <DocumentCard row={row} deputies={profileByProceeding.get(row.vorgangs_id)} />
            </li>)}
          </DocumentDateGroup>)}
          {visible < filtered.length && (
            <Button variant="outline" onClick={() => setVisible(visible + pageSize)}>Weitere Vorgänge anzeigen</Button>
          )}
        </section>
      </div>
    </section>
  );
}
