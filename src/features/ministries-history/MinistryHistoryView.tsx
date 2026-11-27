import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarRange, ListChecks, Plus, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { findings, legislativePeriods } from "./data";
import { confirmHistoryEntries, historyQueryKey, loadMinistryHistory } from "./historyApi";
import HistoryEntryDialog, { historySelectClass, type EditorTarget } from "./HistoryEntryDialog";
import HistoryLineDialog from "./HistoryLineDialog";
import { dateLabel, formatHistoryDate, historySlices, type HistoryEntry, type HistoryLine, type HistoryLink } from "./historyModel";

type Slice = ReturnType<typeof historySlices>[number];

function EntryName({ entry, onEdit }: { entry: HistoryEntry; onEdit: (entry: HistoryEntry) => void }) {
  return <div className="min-w-0 space-y-0.5">
    <button type="button" className="block max-w-full break-words text-left font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
      aria-label={`${entry.name} bearbeiten`} onClick={() => onEdit(entry)}>{entry.name}</button>
    {(entry.party || entry.office) && <p className="break-words text-xs text-muted-foreground">
      {[entry.party, entry.office].filter(Boolean).join(" · ")}
    </p>}
    {!entry.assignment_confirmed && <p className="text-xs text-muted-foreground">Zuordnung offen</p>}
  </div>;
}

function EntrySource({ entry }: { entry: HistoryEntry }) {
  return <div className="break-words text-xs">
    {entry.source_url
      ? <a href={entry.source_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{entry.citation}</a>
      : <p>{entry.citation}</p>}
    {!entry.source_verified && <p className="text-muted-foreground">Quelle ungeprüft</p>}
    {entry.source_detail && <p className="mt-1 text-muted-foreground">{entry.source_detail}</p>}
  </div>;
}

function HistoryTable({ slices, onEdit }: { slices: Slice[]; onEdit: (entry: HistoryEntry) => void }) {
  return <div className="rounded-lg border">
    <Table className="min-w-[48rem]" aria-label="Ministeriumsnamen und Amtszeiten">
      <TableHeader><TableRow className="bg-muted/50">
        <TableHead className="w-40">Zeitraum</TableHead>
        <TableHead>Ministeriumsname</TableHead>
        <TableHead>Leitung</TableHead>
        <TableHead className="w-1/3">Quellen</TableHead>
      </TableRow></TableHeader>
      <TableBody>{slices.map(slice => <TableRow key={slice.from}>
        <TableCell className="align-top text-xs tabular-nums">{dateLabel(slice.from, slice.to)}</TableCell>
        {[slice.phases, slice.terms].map((entries, index) => <TableCell key={index} className="space-y-2 align-top">
          {entries.length ? entries.map(entry => <EntryName key={entry.id} entry={entry} onEdit={onEdit} />)
            : <span className="text-xs text-muted-foreground">Nicht belegt</span>}
        </TableCell>)}
        <TableCell className="space-y-2 align-top">
          {[...slice.phases, ...slice.terms].map(entry => <EntrySource key={entry.id} entry={entry} />)}
        </TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </div>;
}

function TimelineLane({ slices, field, onEdit }: {
  slices: Slice[];
  field: "phases" | "terms";
  onEdit: (entry: HistoryEntry) => void;
}) {
  const signature = (entries: HistoryEntry[]) => JSON.stringify(entries.map(entry => entry.id));
  const groups: { start: number; length: number; entries: HistoryEntry[] }[] = [];
  for (const [index, slice] of slices.entries()) {
    const last = groups.at(-1);
    const entries = slice[field];
    if (last && signature(last.entries) === signature(entries)) last.length++;
    else groups.push({ start: index + 2, length: 1, entries });
  }
  return <div className="grid grid-rows-subgrid" style={{ gridRow: `1 / span ${slices.length + 1}` }}>
    <div className="px-2 py-2 text-xs font-semibold md:px-3">{field === "phases" ? "Ministeriumsname" : "Ministerinnen und Minister"}</div>
    {groups.map(group => <div key={group.start} style={{ gridRow: `${group.start} / span ${group.length}` }}
      className={cn("min-w-0 space-y-2 rounded-md border-l-2 px-2 py-2 text-sm md:px-3",
        group.entries.length ? field === "phases" ? "border-primary/50 bg-primary/5" : "border-teal-600/55 bg-teal-500/5"
          : "border-dashed border-muted-foreground/30 bg-muted/40")}>
      {group.entries.length ? group.entries.map(entry => <div key={entry.id} className="space-y-0.5">
        <EntryName entry={entry} onEdit={onEdit} />
        <p className="text-xs text-muted-foreground tabular-nums">{dateLabel(entry.starts_on, entry.ends_on)}</p>
      </div>) : <p className="text-xs text-muted-foreground">Nicht belegt</p>}
    </div>)}
  </div>;
}

function Timeline({ slices, onEdit }: { slices: Slice[]; onEdit: (entry: HistoryEntry) => void }) {
  return <div className="overflow-x-auto rounded-lg border p-2 md:p-3">
    <div className="grid min-w-[30rem] grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-2"
      aria-label="Chronologische Zeitleiste">
      <div className="grid grid-rows-subgrid" style={{ gridRow: `1 / span ${slices.length + 1}` }}>
        <div className="px-2 py-2 text-xs font-semibold">Zeitachse</div>
        {slices.map(slice => {
          const period = legislativePeriods.find(item => item.from <= slice.from && item.to >= slice.from);
          return <div key={slice.from} className="min-h-10 border-r border-dashed px-2 py-2 text-xs tabular-nums">
            {formatHistoryDate(slice.from)}
            {period && <p className="text-muted-foreground">{period.number}. WP</p>}
          </div>;
        })}
      </div>
      <TimelineLane slices={slices} field="phases" onEdit={onEdit} />
      <TimelineLane slices={slices} field="terms" onEdit={onEdit} />
    </div>
  </div>;
}

function OpenAssignments({ entries, lines, onEdit }: {
  entries: HistoryEntry[];
  lines: HistoryLine[];
  onEdit: (entry: HistoryEntry) => void;
}) {
  const client = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState(() => new Map<string, number>());
  const needle = search.trim().toLocaleLowerCase("de");
  const labelFor = (id: string | null) => lines.find(line => line.id === id)?.label;
  const visible = entries.filter(entry =>
    (!needle || [entry.name, entry.office, labelFor(entry.line_id)].some(value => value?.toLocaleLowerCase("de").includes(needle)))
    && (filter === "all" || (filter === "unassigned" ? !entry.line_id : entry.line_id === filter)));
  const proposals = visible.filter(entry => entry.line_id);
  const selected = proposals.filter(entry => checked.get(entry.id) === entry.revision);
  const allSelected = proposals.length > 0 && selected.length === proposals.length;
  const confirm = useMutation({
    mutationFn: confirmHistoryEntries,
    onSuccess: () => setChecked(new Map()),
    onSettled: () => client.invalidateQueries({ queryKey: historyQueryKey }),
  });

  return <section className="space-y-4" aria-labelledby="ministry-assignments">
    <div>
      <h2 id="ministry-assignments" className="text-lg font-semibold">Offene Zuordnungen</h2>
      <p className="text-sm text-muted-foreground">Prüfe die vorgeschlagene Ressortlinie oder öffne einen Eintrag, um ihn zuzuordnen.</p>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid flex-1 gap-1 text-sm font-medium">Einträge suchen
        <Input type="search" value={search} onChange={event => setSearch(event.target.value)} />
      </label>
      <label className="grid min-w-48 gap-1 text-sm font-medium">Vorgeschlagenes Ministerium
        <select className={historySelectClass} value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="all">Alle offenen Einträge</option>
          <option value="unassigned">Ohne Vorschlag</option>
          {lines.map(line => <option key={line.id} value={line.id}>{line.label}</option>)}
        </select>
      </label>
      <Button disabled={!selected.length || confirm.isPending} onClick={() => confirm.mutate(selected)}>
        {selected.length ? `${selected.length} Zuordnungen bestätigen` : "Auswahl bestätigen"}
      </Button>
    </div>
    {confirm.isError && <p role="alert" className="text-sm text-destructive">{confirm.error.message}</p>}
    {!visible.length ? <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
      {entries.length ? "Keine offenen Einträge für diese Auswahl." : "Alle Einträge sind bestätigt."}
    </p> : <div className="rounded-lg border">
      <Table className="min-w-[31rem]">
        <TableHeader><TableRow>
          <TableHead className="w-10">
            <input type="checkbox" aria-label="Alle sichtbaren Vorschläge auswählen" checked={allSelected}
              disabled={!proposals.length || confirm.isPending} onChange={() => {
                const next = new Map(checked);
                proposals.forEach(entry => allSelected ? next.delete(entry.id) : next.set(entry.id, entry.revision));
                setChecked(next);
              }} />
          </TableHead>
          <TableHead>Eintrag</TableHead><TableHead>Zeitraum</TableHead><TableHead>Vorschlag</TableHead>
        </TableRow></TableHeader>
        <TableBody>{visible.map(entry => <TableRow key={entry.id}>
          <TableCell>{entry.line_id && <input type="checkbox" aria-label={`Vorschlag für ${entry.name} auswählen`}
            disabled={confirm.isPending} checked={checked.get(entry.id) === entry.revision} onChange={event => {
              const next = new Map(checked);
              if (event.target.checked) next.set(entry.id, entry.revision);
              else next.delete(entry.id);
              setChecked(next);
            }} />}</TableCell>
          <TableCell><EntryName entry={entry} onEdit={onEdit} /></TableCell>
          <TableCell className="text-xs tabular-nums">{dateLabel(entry.starts_on, entry.ends_on)}</TableCell>
          <TableCell>{labelFor(entry.line_id) ?? "Ohne Vorschlag"}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>}
  </section>;
}

function LineLinks({ links, lines, current, onSelect, onAdd }: {
  links: HistoryLink[];
  lines: HistoryLine[];
  current: HistoryLine;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const relevant = links.filter(link => link.predecessor_id === current.id || link.successor_id === current.id);
  return <section className="space-y-2 rounded-lg border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">Vorgänger und Nachfolger</h3>
      <Button size="sm" variant="outline" onClick={onAdd}><Plus className="mr-1 size-4" />Verknüpfen</Button>
    </div>
    {relevant.map(link => {
      const outgoing = link.predecessor_id === current.id;
      const other = outgoing ? link.successor_id : link.predecessor_id;
      return <div key={`${link.predecessor_id}:${link.successor_id}:${link.effective_on}`} className="border-t pt-2 text-sm">
        <p className="flex flex-wrap items-center gap-1.5">
          {outgoing ? "Nachfolger" : "Vorgänger"} <ArrowRight className="size-3.5" aria-hidden />
          <button type="button" className="font-medium text-primary underline" onClick={() => onSelect(other)}>
            {lines.find(line => line.id === other)?.label ?? other}
          </button>
          <span className="text-xs text-muted-foreground">· {formatHistoryDate(link.effective_on)}</span>
        </p>
        <p className="mt-1 break-words text-xs text-muted-foreground">{link.note}</p>
      </div>;
    })}
  </section>;
}

export default function MinistryHistoryView() {
  const query = useQuery({ queryKey: historyQueryKey, queryFn: ({ signal }) => loadMinistryHistory(signal) });
  const [lineId, setLineId] = useState("state");
  const [period, setPeriod] = useState("");
  const [mode, setMode] = useState<"timeline" | "table" | "open">("timeline");
  const [lineSearch, setLineSearch] = useState("");
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [lineDialog, setLineDialog] = useState<"new" | HistoryLine | null>(null);

  const selectedLine = query.data?.lines.find(line => line.id === lineId) ?? query.data?.lines[0];
  const selectedPeriod = legislativePeriods.find(item => String(item.number) === period);
  const slices = useMemo(() => historySlices(
    query.data?.entries.filter(entry => entry.line_id === selectedLine?.id) ?? [], selectedPeriod,
  ), [query.data?.entries, selectedLine?.id, selectedPeriod]);

  if (query.isPending) return <p role="status">Ministerien-Historie wird geladen …</p>;
  if (query.isError && !query.data) return <div role="alert" className="space-y-2">
    <p>Ministerien-Historie konnte nicht geladen werden.</p>
    <p className="text-sm text-muted-foreground">{query.error.message}</p>
    <Button variant="outline" onClick={() => void query.refetch()}>Erneut laden</Button>
  </div>;

  const { lines, entries, links } = query.data;
  const pending = entries.filter(entry => !entry.assignment_confirmed);
  const selectLine = (id: string) => {
    setLineId(id);
    if (mode === "open") setMode("timeline");
  };
  const edit = (entry: HistoryEntry) => setEditor({ kind: entry.kind === "phase" ? "phase" : "term", existing: entry });
  const modes = [
    { id: "timeline", label: "Zeitleiste", icon: CalendarRange },
    { id: "table", label: "Tabelle", icon: Table2 },
    { id: "open", label: `Offene Zuordnungen (${pending.length})`, icon: ListChecks },
  ] as const;
  const visibleLines = lines.filter(line => line.label.toLocaleLowerCase("de").includes(lineSearch.trim().toLocaleLowerCase("de")));

  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ministerien-Historie</h1>
        <p className="mt-1 text-sm text-muted-foreground">Baden-Württemberg seit 1952</p>
      </div>
      <Button variant="outline" onClick={() => setLineDialog("new")}><Plus className="mr-1 size-4" />Ministerium anlegen</Button>
    </header>
    <div className="grid gap-4 xl:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-2 rounded-lg border p-3 xl:sticky xl:top-0 xl:self-start">
        <label className="grid gap-2 text-sm font-semibold">Ministerien
          <Input type="search" placeholder="Ministerium suchen" value={lineSearch}
            onChange={event => setLineSearch(event.target.value)} />
        </label>
        <nav aria-label="Ministerien" className="flex max-h-40 flex-wrap gap-1 overflow-y-auto xl:max-h-[65dvh] xl:flex-col xl:flex-nowrap">
          {visibleLines.map(line => <Button key={line.id} type="button" size="sm"
            variant={mode !== "open" && selectedLine?.id === line.id ? "secondary" : "ghost"}
            aria-current={mode !== "open" && selectedLine?.id === line.id ? "true" : undefined}
            className="h-auto justify-start whitespace-normal px-2 py-1.5 text-left"
            onClick={() => selectLine(line.id)}>{line.label}</Button>)}
          {!visibleLines.length && <p className="p-2 text-xs text-muted-foreground">Keine passenden Ministerien.</p>}
        </nav>
      </aside>
      <div className="min-w-0 space-y-4">
        <div role="group" aria-label="Darstellung" className="flex flex-wrap gap-1 rounded-lg border bg-muted/25 p-1">
          {modes.map(item => <Button key={item.id} size="sm" variant={mode === item.id ? "secondary" : "ghost"}
            aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>
            <item.icon className="mr-1.5 size-4" aria-hidden />{item.label}
          </Button>)}
        </div>
        {mode === "open" ? <>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "phase" })}>Namensphase anlegen</Button>
            <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "term" })}>Amtszeit anlegen</Button>
          </div>
          <OpenAssignments entries={pending} lines={lines} onEdit={edit} />
        </> : selectedLine ? <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">{selectedLine.label}</h2>
              <label className="grid gap-1 text-xs font-medium">Wahlperiode
                <select className={historySelectClass} value={period} onChange={event => setPeriod(event.target.value)}>
                  <option value="">Alle Wahlperioden</option>
                  {legislativePeriods.map(item => <option key={item.number} value={item.number}>
                    {item.number}. WP · {item.from.slice(0, 4)}–{item.to.slice(0, 4)}
                  </option>)}
                </select>
              </label>
              {selectedPeriod && <p className="text-xs text-muted-foreground">{dateLabel(selectedPeriod.from, selectedPeriod.to)}
                {selectedPeriod.expected ? " (Ende erwartet)" : ""} · {selectedPeriod.cabinet}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "phase", lineId: selectedLine.id })}>
                <Plus className="mr-1 size-4" />Namensphase
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "term", lineId: selectedLine.id })}>
                <Plus className="mr-1 size-4" />Amtszeit
              </Button>
            </div>
          </div>
          {!slices.length ? <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            Für diesen Zeitraum sind keine Einträge hinterlegt.
          </p> : mode === "table" ? <HistoryTable slices={slices} onEdit={edit} /> : <Timeline slices={slices} onEdit={edit} />}
          <LineLinks links={links} lines={lines} current={selectedLine} onSelect={selectLine} onAdd={() => setLineDialog(selectedLine)} />
        </> : <p className="text-sm text-muted-foreground">Lege das erste Ministerium an.</p>}
        <details className="space-y-3 rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Quellen und geprüfte historische Abweichungen</summary>
          <p className="text-muted-foreground">Die Wahlperioden folgen dem Wahlperioden-Blatt. Das Datum eines Amtsantritts kann zugleich als Enddatum der vorherigen Amtszeit überliefert sein.</p>
          <ul className="space-y-3">{findings.map(finding => <li key={finding.id}>
            <p className="font-medium">{finding.topic}</p>
            <p className="text-xs text-muted-foreground line-through">{finding.previous}</p>
            <p>{finding.corrected}</p>
            {finding.source.url ? <a className="text-xs text-primary underline" href={finding.source.url}
              target="_blank" rel="noopener noreferrer">{finding.source.citation}</a>
              : <p className="text-xs text-muted-foreground">{finding.source.citation}</p>}
          </li>)}</ul>
        </details>
      </div>
    </div>
    {editor && <HistoryEntryDialog target={editor} entries={entries} lines={lines} onClose={() => setEditor(null)} />}
    {lineDialog && <HistoryLineDialog line={lineDialog === "new" ? undefined : lineDialog} lines={lines}
      onClose={() => setLineDialog(null)} onCreated={selectLine} />}
  </div>;
}
