import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AnalysisControls } from '@/features/election-analysis/AnalysisToolbar';
import { DataState, DataTable, StatusNote } from '@/features/election-analysis/shared';
import { useWorkbookAudit } from '@/features/election-analysis/useStateHistory';
import type { WorkbookAudit } from '@/features/election-analysis/stateHistoryModel';
const SourceLink = ({ url }: { url: string }) => <a href={url} target="_blank" rel="noreferrer" className="underline">Quellenlink aus Arbeitsmappe</a>;
const statusLabels = { added: 'Ergänzt', matched: 'Übereinstimmung', conflict: 'Abweichung – bisheriger Wert erhalten' };
function AuditValues({ row }: {
    row: WorkbookAudit;
}) {
    return <details><summary className="cursor-pointer underline">Werte und Herkunft anzeigen</summary><p className="my-2">{row.notes}</p><p>Verglichen am: {new Date(row.compared_at).toLocaleString('de-DE')}</p><p>Arbeitsmappe SHA-256: <code className="break-all">{row.workbook_sha256}</code></p><p>Vorschlag aus Arbeitsmappe:</p><pre className="max-w-lg overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(row.incoming, null, 2)}</pre><p>Bisheriger Wert zum Importzeitpunkt:</p><pre className="max-w-lg overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(row.existing, null, 2)}</pre></details>;
}
export default function WorkbookAuditPanel({ year }: {
    year: number;
}) {
    const query = useWorkbookAudit(year);
    const [conflictsOnly, setConflictsOnly] = useState(false);
    const rows = (query.data || []).filter(r => !conflictsOnly || r.status === 'conflict');
    return <div className="space-y-4">
    <AnalysisControls><Button variant={conflictsOnly ? 'default' : 'outline'} aria-pressed={conflictsOnly} onClick={() => setConflictsOnly(v => !v)}>Nur Abweichungen</Button></AnalysisControls>
    <StatusNote>Dieser Bericht dokumentiert den Vergleich beim Einspielen der Arbeitsmappe. Übereinstimmung bedeutet Zahlenübereinstimmung mit dem damaligen Plattformbestand, keine unabhängige Prüfung der verlinkten Originalquelle. Bestehende Werte werden bei Abweichungen erhalten. Die Prüfsumme gehört zur hochgeladenen Excel-Datei. Weitere historische Parteiergebnisse und die Restgruppe wurden nicht importiert.</StatusNote>
    <DataState loading={query.isLoading} error={query.error} empty={!rows.length} retry={() => void query.refetch()}>
      <DataTable headers={['Bereich', 'Datensatz', 'Abgleichstatus', 'Quelle', 'Fundstelle', 'Details']} rows={rows.map(r => [r.section, r.record_key, <span className={r.status === 'conflict' ? 'font-semibold text-warning' : ''}>{statusLabels[r.status]}</span>, <SourceLink url={r.source_url}/>, `${r.source_sheet}, Zeile ${r.source_row}`, <AuditValues row={r}/>])}/>
    </DataState>
  </div>;
}
