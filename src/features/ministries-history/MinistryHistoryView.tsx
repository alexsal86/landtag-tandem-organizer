import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  findings, legislativePeriods, ministerSourceNote, ministers, ministryPhases,
  periodsForPhase, phasesForLine, phasesForPeriod, ressortLines, sourceKindLabels,
  type MinistryPhase,
} from "./data";

const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

function formatDate(value: string | null) {
  if (!value) return "heute";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : dateFormat.format(parsed);
}

function lineLabel(lineId: string) {
  return ressortLines.find(line => line.id === lineId)?.label ?? lineId;
}

function SourceLine({ phase }: { phase: MinistryPhase }) {
  return <div className="space-y-0.5">
    <p className="text-xs font-medium">
      {sourceKindLabels[phase.source.kind]}: {phase.source.citation}
      {!phase.verified && <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] uppercase tracking-wide">ungeprüft</span>}
    </p>
    {phase.source.detail && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{phase.source.detail}</p>}
    {phase.source.url && <a className="text-xs text-primary underline" href={phase.source.url} target="_blank" rel="noopener noreferrer">
      Gesetzblatt öffnen
    </a>}
  </div>;
}

export default function MinistryHistoryView() {
  const [line, setLine] = useState("all");
  const [period, setPeriod] = useState("all");

  const selectedPeriod = period === "all" ? null : legislativePeriods.find(item => item.number === Number(period)) ?? null;

  const phases = useMemo(() => {
    const base = line === "all" ? ministryPhases : phasesForLine(line);
    const filtered = period === "all" ? base : phasesForPeriod(Number(period)).filter(phase => base.includes(phase));
    return filtered.slice().sort((a, b) => a.from.localeCompare(b.from) || a.name.localeCompare(b.name, "de"));
  }, [line, period]);

  const terms = useMemo(() => {
    const base = line === "all" ? ministers : ministers.filter(term => term.lineId === line);
    const filtered = selectedPeriod
      ? base.filter(term => periodsForPhase({ from: term.from, to: term.to }, [selectedPeriod]).length > 0)
      : base;
    return filtered.slice().sort((a, b) => ressortLines.findIndex(item => item.id === a.lineId) - ressortLines.findIndex(item => item.id === b.lineId) || a.from.localeCompare(b.from));
  }, [line, selectedPeriod]);

  return <div className="space-y-5 font-sans">
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold">Ministerien seit 1952</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Amtliche Bezeichnungen der Ministerien Baden-Württembergs mit Datum, Ressortlinie und Quelle,
        dazu die Ministerinnen und Minister mit Amtszeit. Beginn und Ende der Wahlperioden stammen aus den
        Systemdaten (Wahlperioden-Blatt), nicht aus Schätzungen. Nicht im Original geprüfte Angaben sind als ungeprüft gekennzeichnet.
      </p>
    </header>

    <div className="flex flex-wrap gap-3">
      <label className="grid gap-1 text-xs font-medium">Ressortlinie
        <select className="h-9 min-w-56 rounded-md border border-input bg-background px-2 text-sm"
          value={line} onChange={event => setLine(event.target.value)}>
          <option value="all">Alle Ressortlinien</option>
          {ressortLines.map(item => <option key={item.id} value={item.id}>{item.marker} {item.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium">Wahlperiode
        <select className="h-9 min-w-56 rounded-md border border-input bg-background px-2 text-sm"
          value={period} onChange={event => setPeriod(event.target.value)}>
          <option value="all">Alle Wahlperioden</option>
          {legislativePeriods.map(item => <option key={item.number} value={item.number}>
            {item.number}. Wahlperiode · {item.from.slice(0, 4)}–{item.expected ? "erwartet " : ""}{item.to.slice(0, 4)}
          </option>)}
        </select>
      </label>
    </div>

    {selectedPeriod && <p className="text-xs text-muted-foreground">
      {selectedPeriod.number}. Wahlperiode: {formatDate(selectedPeriod.from)} – {formatDate(selectedPeriod.to)}
      {selectedPeriod.expected ? " (erwartetes Ende)" : ""} · {selectedPeriod.cabinet} · {sourceKindLabels[selectedPeriod.source.kind]}: {selectedPeriod.source.citation}
      {selectedPeriod.source.detail ? ` – ${selectedPeriod.source.detail}` : ""}
    </p>}

    <Card>
      <CardHeader><CardTitle className="text-lg">
        {phases.length} {phases.length === 1 ? "Namensphase" : "Namensphasen"}
      </CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {!phases.length && <p className="text-sm text-muted-foreground">Für diese Auswahl ist keine Phase hinterlegt.</p>}
        <ul className="space-y-3">
          {phases.map(phase => <li key={phase.id} className="min-w-0 rounded-md border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium [overflow-wrap:anywhere]">{phase.name}</p>
              <p className="text-xs text-muted-foreground">{formatDate(phase.from)} – {formatDate(phase.to)}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {lineLabel(phase.lineId)} · Wahlperioden {periodsForPhase(phase).join(", ")}
            </p>
            {phase.note && <p className="mt-1 text-xs [overflow-wrap:anywhere]">{phase.note}</p>}
            <div className="mt-2 border-t pt-2"><SourceLine phase={phase} /></div>
          </li>)}
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-lg">
        Ministerinnen und Minister ({terms.length})
      </CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{ministerSourceNote}</p>
        {!terms.length && <p className="text-sm text-muted-foreground">Für diese Auswahl ist keine Amtszeit hinterlegt.</p>}
        <div className="space-y-4">
          {ressortLines.map(item => {
            const entries = terms.filter(term => term.lineId === item.id);
            if (!entries.length) return null;
            return <section key={item.id} className="space-y-2">
              <h3 className="text-sm font-semibold">{item.marker} {item.label}</h3>
              <ul className="space-y-1.5">
                {entries.map(term => <li key={term.id} className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="[overflow-wrap:anywhere]">
                      {term.name} <span className="text-xs text-muted-foreground">({term.party})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(term.from)} – {formatDate(term.to)}</p>
                  </div>
                  {term.office && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{term.office}</p>}
                  {term.note && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{term.note}</p>}
                </li>)}
              </ul>
            </section>;
          })}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-lg">Geprüfte Korrekturen</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Stellen, an denen Chronik oder Ministeriumsartikel von den Gesetzblatt-Bekanntmachungen abweichen.
        </p>
        <ul className="space-y-3">
          {findings.map(finding => <li key={finding.id} className="min-w-0 rounded-md border p-3">
            <p className="text-sm font-medium">{finding.topic}</p>
            <p className="text-xs text-muted-foreground line-through [overflow-wrap:anywhere]">{finding.previous}</p>
            <p className="text-sm [overflow-wrap:anywhere]">{finding.corrected}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {sourceKindLabels[finding.source.kind]}: {finding.source.citation}
              {finding.source.url && <> · <a className="text-primary underline" href={finding.source.url} target="_blank" rel="noopener noreferrer">öffnen</a></>}
            </p>
          </li>)}
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-lg">Wie die Zuordnung gelesen wird</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><span className="font-medium">●</span> durchgehend dieselbe Behörde · <span className="font-medium">◐</span> Kern gleich, Ressort umgeschnitten · <span className="font-medium">○</span> neu gebildet oder aufgelöst.</p>
        <p className="text-muted-foreground">
          Eine Namensänderung ändert keine Zuständigkeiten: Nach § 9 Abs. 2 des Landesverwaltungsgesetzes bleibt eine gesetzlich
          zugewiesene Zuständigkeit bei einer Änderung der Ministeriumsbezeichnung unberührt. Die Ressortlinien entsprechen den
          Zuordnungen der parlamentarischen Vorgänge. Eine Namensphase ist einer Wahlperiode zugeordnet, wenn sich ihre Laufzeit
          mit dem Zeitraum der Wahlperiode überschneidet.
        </p>
      </CardContent>
    </Card>
  </div>;
}
