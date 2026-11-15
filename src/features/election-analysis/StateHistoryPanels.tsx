import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalysisControls } from './AnalysisToolbar';
import { DataState, DataTable, Selection, StatusNote, chartColor } from './shared';
import { ballotLabels, exportAnalysisCsv, number, parties, percent } from './model';
import { matrixAxes, matrixCell, stateTotalMetrics } from './stateHistoryModel';
import { useFlowMatrix, useStateHistory, useWorkbookAudit } from './useStateHistory';
import type { WorkbookAudit } from './stateHistoryModel';
const SourceLink = ({ url }: {
    url: string;
}) => <a href={url} target="_blank" rel="noreferrer" className="underline">Quellenlink aus Arbeitsmappe</a>;
const statusLabels = { added: 'Ergänzt', matched: 'Übereinstimmung', conflict: 'Abweichung – bisheriger Wert erhalten' };
export function StateHistoryPanel({ year, years }: {
    year: number;
    years: number[];
}) {
    const [params, setParams] = useSearchParams();
    const ordered = years.slice().sort((a, b) => a - b);
    const requestedFrom = Number(params.get('historyFrom'));
    const from = ordered.includes(requestedFrom) && requestedFrom <= year ? requestedFrom : ordered[0] || year;
    const query = useStateHistory(from, year);
    const totals = (query.data?.totals || []).map(stateTotalMetrics);
    const rows = totals.map(t => ({ ...t, ...Object.fromEntries(parties.map(p => [p, query.data?.state.find(s => s.year === t.year && s.party === p)?.share ?? null])) }));
    const [metric, setMetric] = useState('turnout');
    const csv = totals.map(t => ({ Wahljahr: t.year, Wahltag: t.election_date, Stimmenart: ballotLabels[t.ballot], Wahlberechtigte: t.eligible, Waehlende: t.voters, Nichtwaehlende: t.nonvoters, Beteiligung_Prozent: t.turnout, Gueltige_Stimmen: t.valid_votes, Ungueltige_Stimmen: t.invalid_votes, Ungueltige_Prozent: t.invalidShare, Quelle: t.source_url, Original_unabhaengig_geprueft: t.source_verified, Arbeitsmappe_SHA256: t.workbook_sha256, Blatt: t.source_sheet, Zeile: t.source_row }));
    return <div className="space-y-4">
    <AnalysisControls>
      <Selection id="history-from" label="Zeitreihe ab Wahl" value={String(from)} onChange={v => setParams(old => { const next = new URLSearchParams(old); next.set('historyFrom', v); return next; })}>{ordered.filter(y => y <= year).map(y => <option key={y} value={y}>{y}</option>)}</Selection>
      <Selection id="history-metric" label="Darstellung" value={metric} onChange={setMetric}>
        <option value="turnout">Wahlbeteiligung (%)</option><option value="persons">Wahlberechtigte / Wahlteilnahme</option><option value="invalid">Ungültige Stimmen (%)</option><option value="parties">Parteianteile (%)</option>
      </Selection>
      <Button variant="outline" disabled={!totals.length} onClick={() => exportAnalysisCsv(csv, `Landesgeschichte-${from}-${year}.csv`)}>Bezugsgrößen als CSV</Button>
      <Button variant="outline" disabled={!query.data?.state.length} onClick={() => exportAnalysisCsv((query.data?.state || []).map(s => ({ Wahljahr: s.year, Stimmenart: ballotLabels[s.year >= 2026 ? 'second' : 'single'], Partei: s.party, Stimmen: s.votes, Anteil_Prozent: s.share, Gueltige_Stimmen: s.valid_votes, Hinweis: s.notes })), `Landesparteien-${from}-${year}.csv`)}>Parteiergebnisse als CSV</Button>
    </AnalysisControls>
    <StatusNote>Landesgeschichte {from}–{year}. Die oben ausgewählte Wahl ist das Ende der Zeitreihe. Bis 2021 wird die Einzelstimme, ab 2026 die Zweitstimme verwendet; 2026 beginnt ein neues Wahlsystem. 1952 war die Wahl zur Verfassunggebenden Landesversammlung. Weitere historische Parteien werden nicht ergänzt. Fehlende Parteieinträge bleiben unbekannt und werden nicht als 0 dargestellt. Quellenlinks stammen aus der Arbeitsmappe; eine unabhängige Originalprüfung wird nur bei ausdrücklicher Kennzeichnung behauptet.</StatusNote>
    <DataState loading={query.isLoading} error={query.error} empty={!totals.length} retry={() => void query.refetch()}>
      <Card><CardHeader><CardTitle className="text-lg">{metric === 'parties' ? 'Ausgewählte Parteianteile' : metric === 'persons' ? 'Wahlberechtigte, Wählende und Nichtwählende' : metric === 'invalid' ? 'Anteil ungültiger Stimmen an Wählenden' : 'Wahlbeteiligung'} · {from}–{year}</CardTitle></CardHeader><CardContent>
        <div className="h-80" role="img" aria-label="Historische Landes-Zeitreihe; genaue Werte folgen in den Tabellen"><ResponsiveContainer><LineChart data={rows} margin={{ left: metric === 'persons' ? 35 : 0, right: 20 }}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="year"/><YAxis unit={metric === 'persons' ? '' : ' %'} tickFormatter={v => number(Number(v))}/><Tooltip formatter={v => metric === 'persons' ? number(typeof v === 'number' ? v : null) : percent(typeof v === 'number' ? v : null)}/><Legend />
          {metric === 'parties' ? parties.map(p => <Line key={p} dataKey={p} name={p} stroke={chartColor(p)} connectNulls={false}/>) : metric === 'persons' ? <><Line dataKey="eligible" name="Wahlberechtigte" stroke="#475569"/><Line dataKey="voters" name="Wählende" stroke="#4b8b39"/><Line dataKey="nonvoters" name="Nichtwählende" stroke="#b65c55"/></> : <Line dataKey={metric === 'invalid' ? 'invalidShare' : 'turnout'} name={metric === 'invalid' ? 'Ungültige Stimmen' : 'Wahlbeteiligung'} stroke="#4b8b39" connectNulls={false}/>}
        </LineChart></ResponsiveContainer></div>
      </CardContent></Card>
      <div className="overflow-x-auto"><DataTable headers={['Wahl', 'Wahltag', 'Wahlberechtigte', 'Wählende', 'Nichtwählende', 'Beteiligung', 'Gültige Stimmen', 'Ungültige Stimmen', 'Ungültige %', 'Quelle / Prüfstatus']} rows={totals.map(t => [t.year, t.election_date.split('-').reverse().join('.'), number(t.eligible), number(t.voters), number(t.nonvoters), percent(t.turnout), number(t.valid_votes), number(t.invalid_votes), percent(t.invalidShare), <span><SourceLink url={t.source_url}/> · {t.source_verified ? 'Original geprüft' : 'Originalprüfung offen'} · {t.source_sheet}, Z. {t.source_row}</span>])}/></div>
      {metric === 'parties' && <DataTable headers={['Wahl', 'Stimmenart', 'Partei', 'Stimmen', 'Anteil', 'Hinweis / Quelle']} rows={(query.data?.state || []).map(s => [s.year, ballotLabels[s.year >= 2026 ? 'second' : 'single'], s.party, number(s.votes), percent(s.share), s.notes || 'Bestehender Datensatz; Quellenabgleich unter „Quellenabgleich“.'])}/>}
    </DataState>
  </div>;
}
export function FlowMatrixPanel({ year }: {
    year: number;
}) {
    const query = useFlowMatrix(year);
    const cells = query.data || [];
    const { origins, destinations } = matrixAxes(cells);
    const previous = cells[0]?.previous_year;
    return <div className="space-y-4">
    <AnalysisControls><Button variant="outline" disabled={!cells.length} onClick={() => exportAnalysisCsv(cells.map(c => ({ Vorwahl: c.previous_year, Wahljahr: c.year, Herkunft: c.origin, Ziel: c.destination, Personen: c.persons, Datentyp: 'Gerundete Modellschätzung', Quelle: c.source_url, Fundstelle: 'S. 33', Blatt: c.source_sheet, Zeile: c.source_row, Arbeitsmappe_SHA256: c.workbook_sha256, Original_unabhaengig_geprueft: c.source_verified })), `Wanderungsmatrix-${year}.csv`)}>Matrix als CSV</Button></AnalysisControls>
    <StatusNote>Die vollständige Wanderungsmatrix liegt aus dieser Arbeitsmappe für 2001 → 2006 vor. Alle Werte sind gerundete landesweite Modellschätzungen von Infratest dimap. Zeilen zeigen das Ziel, Spalten die Herkunft. Diagonalwerte zeigen Parteibindung beziehungsweise fortgesetzte Nichtwahl. Erstwählende und Zugezogene stehen auf der Herkunftsseite, Gestorbene und Weggezogene auf der Zielseite. Keine beobachteten individuellen Wechsel, keine Wahlkreisdaten und keine amtlich ausgezählten Parteiergebnisse.</StatusNote>
    <DataState loading={query.isLoading} error={query.error} empty={!cells.length} retry={() => void query.refetch()}>
      <h2 className="text-lg font-semibold">Wählerwanderung {previous} → {year} · Personen</h2>
      <div className="overflow-x-auto"><DataTable headers={[`Ziel ${year} / Herkunft ${previous}`, ...origins]} rows={destinations.map(destination => [destination, ...origins.map(origin => <span key={origin} className={origin === destination ? 'font-semibold' : ''}>{number(matrixCell(cells, origin, destination))}</span>)])}/></div>
      {cells[0] && <p className="text-sm"><SourceLink url={cells[0].source_url}/> · Wahlreport 2006, S. 33 · {cells.every(c => c.source_verified) ? 'Original unabhängig geprüft.' : 'Aus Arbeitsmappe übernommen; Originalprüfung offen.'} Der Zustrom von den Grünen zur CDU beträgt in der Arbeitsmappe 11.000 Personen.</p>}
    </DataState>
  </div>;
}
function AuditValues({ row }: {
    row: WorkbookAudit;
}) {
    return <details><summary className="cursor-pointer underline">Werte und Herkunft anzeigen</summary><p className="my-2">{row.notes}</p><p>Verglichen am: {new Date(row.compared_at).toLocaleString('de-DE')}</p><p>Arbeitsmappe SHA-256: <code className="break-all">{row.workbook_sha256}</code></p><p>Vorschlag aus Arbeitsmappe:</p><pre className="max-w-lg overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(row.incoming, null, 2)}</pre><p>Bisheriger Wert zum Importzeitpunkt:</p><pre className="max-w-lg overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(row.existing, null, 2)}</pre></details>;
}
export function WorkbookAuditPanel({ year }: {
    year: number;
}) {
    const query = useWorkbookAudit(year);
    const [conflictsOnly, setConflictsOnly] = useState(false);
    const rows = (query.data || []).filter(r => !conflictsOnly || r.status === 'conflict');
    return <div className="space-y-4">
    <AnalysisControls><Button variant={conflictsOnly ? 'default' : 'outline'} aria-pressed={conflictsOnly} onClick={() => setConflictsOnly(v => !v)}>Nur Abweichungen</Button><Button variant="outline" disabled={!rows.length} onClick={() => exportAnalysisCsv(rows.map(r => ({ Wahljahr: r.year, Bereich: r.section, Datensatz: r.record_key, Status: statusLabels[r.status], Verglichen_am: r.compared_at, Quelle: r.source_url, Blatt: r.source_sheet, Zeile: r.source_row, Arbeitsmappe_SHA256: r.workbook_sha256, Arbeitsmappe: JSON.stringify(r.incoming), Bisher: JSON.stringify(r.existing), Hinweis: r.notes })), `Quellenabgleich-${year}.csv`)}>Abgleich als CSV</Button></AnalysisControls>
    <StatusNote>Dieser Bericht dokumentiert den Vergleich beim Einspielen der Arbeitsmappe. Übereinstimmung bedeutet Zahlenübereinstimmung mit dem damaligen Plattformbestand, keine unabhängige Prüfung der verlinkten Originalquelle. Bestehende Werte werden bei Abweichungen erhalten. Die Prüfsumme gehört zur hochgeladenen Excel-Datei. Weitere historische Parteiergebnisse und die Restgruppe wurden nicht importiert.</StatusNote>
    <DataState loading={query.isLoading} error={query.error} empty={!rows.length} retry={() => void query.refetch()}>
      <DataTable headers={['Bereich', 'Datensatz', 'Abgleichstatus', 'Quelle', 'Fundstelle', 'Details']} rows={rows.map(r => [r.section, r.record_key, <span className={r.status === 'conflict' ? 'font-semibold text-amber-800' : ''}>{statusLabels[r.status]}</span>, <SourceLink url={r.source_url}/>, `${r.source_sheet}, Zeile ${r.source_row}`, <AuditValues row={r}/>])}/>
    </DataState>
  </div>;
}
/** Small source notice in the existing result / flow panels. */
export function WorkbookSourceNotice({ year, section }: {
    year: number;
    section: 'state' | 'flows';
}) {
    const query = useWorkbookAudit(year, section);
    if (query.isLoading)
        return <p role="status" className="text-sm">Quellenabgleich lädt …</p>;
    if (query.error)
        return <p role="alert" className="text-sm">Quellenabgleich konnte nicht geladen werden. <Button variant="link" onClick={() => void query.refetch()}>Erneut laden</Button></p>;
    if (!query.data?.length)
        return null;
    const conflicts = query.data.filter(r => r.status === 'conflict');
    const sources = [...new Set(query.data.map(r => r.source_url))];
    return <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Quellenabgleich · {conflicts.length} offene Abweichungen</summary><p className="my-2">Arbeitsmappe mit dem Bestand zum Importzeitpunkt verglichen. Originalquellen noch nicht unabhängig geprüft. Einzelwerte und Herkunft stehen unter „Quellenabgleich“.</p>{sources.map(url => <p key={url}><SourceLink url={url}/></p>)}{conflicts.map(r => <div key={r.id} className="mt-3"><p className="font-semibold">{r.record_key}: bisheriger Wert erhalten.</p><AuditValues row={r}/></div>)}</details>;
}
