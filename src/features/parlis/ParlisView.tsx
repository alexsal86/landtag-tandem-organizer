import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Search } from "lucide-react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TopicFilter } from "./TopicFilter";
import { DocumentCard } from "./DocumentCard";
import { documentCount, number } from "./documents";
import { dimensions, type Dimension } from "./grouping";
import { loadOptions, loadPage, pageSize } from "./page";
import "./parlis.css";

const month = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

function groupLabel(key: string, dimension: Dimension) {
  return dimension === "datum" && key !== "Ohne Angabe" ? month.format(new Date(key + "-01T00:00:00Z")) : key;
}

const emptyFilters = { kind: "", party: "", from: "", to: "", topic: "" };

export default function ParlisView() {
  const [params, setParams] = useSearchParams();
  const legislature = params.get("wahlperiode") === "17" ? 17 : 18;
  return <ProceedingsForLegislature key={legislature} legislature={legislature} changeLegislature={value => {
    const next = new URLSearchParams(params);
    next.set("wahlperiode", value);
    setParams(next);
  }} />;
}

function ProceedingsForLegislature({ legislature, changeLegislature }: {
  legislature: number;
  changeLegislature: (value: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const deputyKey = params.get("urheber");
  const [search, setSearch] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [oldestFirst, setOldestFirst] = useState(false);
  const [dimension, setDimension] = useState<Dimension>("datum");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const loadMore = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchText(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const args = {
    period: legislature,
    search_text: searchText,
    document_kind: filters.kind,
    faction: filters.party,
    topic: filters.topic,
    date_from: filters.from || undefined,
    date_to: filters.to || undefined,
    deputy_key: deputyKey ?? undefined,
    oldest_first: oldestFirst,
    chart_dimension: analysisOpen || selected !== null ? dimension : undefined,
    chart_selection: selected ?? undefined,
  };
  const query = useInfiniteQuery({
    queryKey: ["parlis-pages", args],
    queryFn: ({ signal, pageParam }) => loadPage({ ...args, page_offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last, [first], offset) =>
      last.rows.length === pageSize && offset + pageSize < (first.count ?? 0) ? offset + pageSize : undefined,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const options = useQuery({
    queryKey: ["parlis-filter-options", legislature],
    queryFn: ({ signal }) => loadOptions(legislature, signal),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError } = query;
  useEffect(() => {
    if (!loadMore.current || !hasNextPage || isFetching || isFetchNextPageError ||
      search.trim() !== searchText || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void fetchNextPage({ cancelRefetch: false });
    }, { rootMargin: "0px 0px 120px 0px" });
    observer.observe(loadMore.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetching, isFetchNextPageError, search, searchText]);

  const first = query.data?.pages[0];
  const rows = query.data?.pages.flatMap(page => page.rows) ?? [];
  const deputyName = deputyKey ? rows.find(row => row.deputies.some(([key]) => key === deputyKey))
    ?.deputies.find(([key]) => key === deputyKey)?.[1] : undefined;
  const chartGroups = first?.groups ?? [];
  const max = Math.max(1, ...chartGroups.map(([, count]) => count));
  const hasFilters = !!(search || selected || deputyKey || oldestFirst || Object.values(filters).some(Boolean));

  function updateFilter(key: keyof typeof emptyFilters, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
    setSelected(null);
  }

  function clearDeputy() {
    const next = new URLSearchParams(params);
    next.delete("urheber");
    setParams(next);
    setSelected(null);
  }

  return (
    <section className="parlis-page">
      <div className="parlis-content">
        <header className="parlis-heading">
          <div>
            <h1>Parlamentarische Vorgänge</h1>
            <p>Landtag Baden-Württemberg</p>
          </div>
          <label>Wahlperiode
            <select aria-label="Wahlperiode" value={legislature} onChange={event => changeLegislature(event.target.value)}>
              <option value={18}>18. Wahlperiode</option>
              <option value={17}>17. Wahlperiode</option>
            </select>
          </label>
        </header>
        {options.isError && <p role="alert">Filteroptionen konnten nicht geladen werden.{" "}
          <Button variant="link" onClick={() => void options.refetch()}>Erneut laden</Button>
        </p>}
        <section className="parlis-filters" aria-label="Dokumente suchen und filtern">
          <label className="parlis-search">
            <span className="sr-only">Dokumente suchen</span>
            <Search size={18} aria-hidden="true" />
            <Input type="search" value={search} placeholder="Titel, Schlagwort, Drucksache …" onChange={event => {
              setSearch(event.target.value);
              setSelected(null);
            }} />
          </label>
          <div className="parlis-filter-grid">
            <label>Dokumententyp<select aria-label="Dokumententyp" value={filters.kind} onChange={event => updateFilter("kind", event.target.value)}>
              <option value="">Alle Typen</option>
              {options.data?.kinds.map(kind => <option key={kind}>{kind}</option>)}
            </select></label>
            <label>Fraktion<select aria-label="Fraktion" value={filters.party} onChange={event => updateFilter("party", event.target.value)}>
              <option value="">Alle Fraktionen</option>
              {options.data?.parties.map(party => <option key={party}>{party}</option>)}
              <option value="__unknown">Ohne Fraktionsangabe</option>
            </select></label>
            <TopicFilter period={legislature} value={filters.topic} onChange={value => updateFilter("topic", value)} />
            <label>Datum von<Input type="date" value={filters.from} max={filters.to || undefined} onChange={event => updateFilter("from", event.target.value)} /></label>
            <label>Datum bis<Input type="date" value={filters.to} min={filters.from || undefined} onChange={event => updateFilter("to", event.target.value)} /></label>
            <label>Sortierung<select aria-label="Sortierung" value={oldestFirst ? "asc" : "desc"} onChange={event => {
              setOldestFirst(event.target.value === "asc");
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
              setSearchText("");
              setFilters(emptyFilters);
              setOldestFirst(false);
              if (deputyKey) clearDeputy();
              else setSelected(null);
            }}>Filter zurücksetzen</Button>}
          </div>
        </section>
        <details className="parlis-analysis" onToggle={event => setAnalysisOpen(event.currentTarget.open)}>
          <summary>Auswertung <ChevronDown size={16} aria-hidden="true" /></summary>
          <label>Gruppieren nach
            <select aria-label="Gruppieren nach" value={dimension} onChange={event => {
              setDimension(event.target.value as Dimension);
              setSelected(null);
            }}>
              {Object.entries(dimensions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          {chartGroups.length > 0 && (
            <div className="space-y-2 rounded-lg border p-4" role="group" aria-label="Vorgänge je Gruppe">
              <p className="text-sm text-muted-foreground">
                {dimension !== "datum" && chartGroups.length === 12 && "Bis zu 12 häufigste Gruppen · "}
                {dimension === "deskriptoren" && "Mehrere Schlagwörter pro Vorgang möglich · "}
                Balken auswählen, um die Treffer einzugrenzen
              </p>
              {chartGroups.map(([key, count]) => (
                <button key={key} type="button" aria-pressed={selected === key}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 rounded-md px-2 py-1 text-left text-sm hover:bg-muted aria-pressed:bg-accent"
                  onClick={() => setSelected(selected === key ? null : key)}>
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
        <section className="parlis-results" aria-label="Dokumente" aria-busy={isFetching}>
          {query.isPending ? <p role="status">Parlamentarische Vorgänge werden geladen …</p> : !first ? (
            <div role="alert">
              <p>Die parlamentarischen Vorgänge konnten nicht geladen werden.</p>
              <Button variant="outline" onClick={() => void query.refetch()}>Erneut laden</Button>
            </div>
          ) : <>
            <h2 aria-live="polite">
              {documentCount(first.count ?? 0)} <span>von {number.format(first.total ?? 0)}</span>
              {selected !== null && <span> · {groupLabel(selected, dimension)}</span>}
            </h2>
            {!rows.length && <p className="parlis-empty">Keine Vorgänge gefunden.</p>}
            {rows.length > 0 && <ul className="parlis-card-list">
              {rows.map(row => <li key={row.vorgangs_id}><DocumentCard row={row} /></li>)}
            </ul>}
            {hasNextPage && (
              <Button ref={loadMore} variant="outline" disabled={isFetching}
                onClick={() => void fetchNextPage({ cancelRefetch: false })}>
                {query.isFetchingNextPage ? "Weitere Vorgänge werden geladen …"
                  : isFetchNextPageError ? "Nachladen erneut versuchen" : "Weitere Vorgänge anzeigen"}
              </Button>
            )}
          </>}
        </section>
      </div>
    </section>
  );
}
