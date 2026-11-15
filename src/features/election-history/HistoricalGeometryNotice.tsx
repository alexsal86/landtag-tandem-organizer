import { reconstructedBoundaryInfo } from '@/utils/electoralGeometryCatalog';

export function HistoricalGeometryNotice({ year }: { year?: number | null }) {
  const info = reconstructedBoundaryInfo(year);
  if (!info) return null;
  return <aside className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2" aria-label={`Kartengrundlage ${info.title}`}>
    <p><strong>{info.title}: historische Rekonstruktion.</strong> {info.reference} Besonders innerstädtische Grenzen und frühere Gemeindegrenzen enthalten Näherungen; die Karte ist kein amtlicher Originalumriss.</p>
    {info.title === '1952' ? <p>1952 werden Landesteil und historische Nummer zusammen angezeigt: Nordwürttemberg (NW), Nordbaden (NB), Südbaden (SB) und Südwürttemberg-Hohenzollern (SWH). So sind beispielsweise NW 1, SB 1 und SWH 1 verschiedene Wahlkreise. Bestehende Mandate werden nicht allein nach technischen Nummern verknüpft.</p> : <p>Es gelten die damaligen Namen und Nummern: Nr. 37 Bruchsal, Nr. 31–33 Mannheim-Stadt I–III und Nr. 1–5 Stuttgart I–V. Gleiche Nummern in späteren Wahlen bedeuten keine Gebietsidentität.</p>}
    {info.title === '1952' && <details>
      <summary className="cursor-pointer">Dokumentierte örtliche Unsicherheiten</summary>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>Die Abgrenzung Freiburgs zwischen SB 7 und SB 8 beruht auf einer angenäherten Maske für damalige Stadtteile.</li>
        <li>Die damalige Gemeinde Hartheim im Landkreis Stockach konnte nicht zuverlässig der heutigen Gemarkung Hartheim bei Meßstetten zugeordnet werden.</li>
        <li>Duchtlingen ist in den verwendeten aktuellen Gemarkungsdaten nicht eigenständig abgrenzbar.</li>
      </ul>
    </details>}
    <p>Historische Kreisgrenzen: © BKG (2026), CC BY 4.0. Gemarkungen: © LGL Baden-Württemberg (2026), Datenlizenz Deutschland – Namensnennung 2.0. Daten verändert und kombiniert.</p>
    <p className="flex flex-wrap gap-3">
      {info.sourceUrl && <a className="underline" href={info.sourceUrl} target="_blank" rel="noopener noreferrer">Historische Wahlkreiseinteilung</a>}
      <a className="underline" href="https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg-hist.pdf" target="_blank" rel="noopener noreferrer">BKG-Quellenvermerk</a>
    </p>
  </aside>;
}
