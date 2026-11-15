import { reconstructedBoundaryInfo } from '@/utils/electoralGeometryCatalog';

export function HistoricalGeometryNotice({ year }: { year?: number | null }) {
  const info = reconstructedBoundaryInfo(year);
  if (!info) return null;
  return <aside className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2" aria-label={`Kartengrundlage ${info.title}`}>
    <p><strong>{info.title}: historische Rekonstruktion.</strong> {info.reference} Besonders innerstädtische Grenzen und frühere Gemeindegrenzen enthalten Näherungen; die Karte ist kein amtlicher Originalumriss.</p>
    <p>Es gelten die damaligen Namen und Nummern: Nr. 37 Bruchsal, Nr. 31–33 Mannheim-Stadt I–III und Nr. 1–5 Stuttgart I–V. Gleiche Nummern in späteren Wahlen bedeuten keine Gebietsidentität.</p>
    <p>Historische Kreisgrenzen: © BKG (2026), CC BY 4.0. Gemarkungen: © LGL Baden-Württemberg (2026), Datenlizenz Deutschland – Namensnennung 2.0. Daten verändert und kombiniert.</p>
    <p className="flex flex-wrap gap-3">
      <a className="underline" href={info.sourceUrl} target="_blank" rel="noopener noreferrer">Historische Wahlkreiseinteilung</a>
      <a className="underline" href="https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg-hist.pdf" target="_blank" rel="noopener noreferrer">BKG-Quellenvermerk</a>
    </p>
  </aside>;
}
