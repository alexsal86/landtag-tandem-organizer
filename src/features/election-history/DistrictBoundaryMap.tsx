import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { electoralGeometryYear, loadElectoralDistrict } from '@/utils/electoralTopology';
import { ELECTORAL_DISTRICT_MANIFESTS } from '@/utils/electoralDistrictAsset';
import { historical1952Source, reconstructedGeometryAttribution } from '@/utils/electoralGeometryCatalog';
import { confirmedPeriodGeometryYear } from './periodGeometry';
import { HistoricalGeometryNotice } from './HistoricalGeometryNotice';
import type { ElectionPeriod, HistoricalDistrict } from './types';

type DistrictBoundaryMapProps =
  | { period: ElectionPeriod | undefined; district: HistoricalDistrict }
  | { analysis: { year: number; number: number; name: string; confirmedGeometryYear?: number } };

export default function DistrictBoundaryMap(props: DistrictBoundaryMapProps) {
  const period = 'period' in props ? props.period : undefined;
  const district = 'district' in props ? props.district : {
    name: props.analysis.name,
    district_number: props.analysis.number,
    geometry_source_key: null,
    boundaries: null,
  };

  const [neighbors, setNeighbors] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const year = 'analysis' in props
    ? (props.analysis.confirmedGeometryYear !== undefined
      && props.analysis.confirmedGeometryYear === electoralGeometryYear(props.analysis.year)
      ? props.analysis.confirmedGeometryYear : null)
    : confirmedPeriodGeometryYear(period);
  const source1952 = period?.election_year === 1952 ? historical1952Source(district.geometry_source_key) : undefined;
  const number = period?.election_year === 1952 ? source1952?.technicalNumber ?? null : district.district_number;
  // Individually supplied geometry always takes precedence; it has no inferred neighbors.
  const shared = !district.boundaries && year !== null && number !== null;
  const query = useQuery({
    queryKey: ['district-boundary', year === null ? null : ELECTORAL_DISTRICT_MANIFESTS[year], number, neighbors],
    enabled: shared,
    queryFn: () => loadElectoralDistrict(year!, number!, neighbors),
    staleTime: Infinity, gcTime: 300_000, retry: false,
  });
  const geometry = district.boundaries;
  const data = query.data;
  useEffect(() => {
    if (!container.current || (!geometry && !data)) return;
    const map = L.map(container.current, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    const attribution = reconstructedGeometryAttribution(year);
    if (attribution) map.attributionControl.addAttribution(attribution);
    const collection = geometry ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { Nummer: number, Name: district.name }, geometry }] } : data;
    const layer = L.geoJSON(collection as GeoJSON.GeoJsonObject, {
      style: feature => ({ color: Number(feature?.properties?.Nummer) === number ? '#15803d' : '#64748b', weight: 2, fillOpacity: Number(feature?.properties?.Nummer) === number ? 0.35 : 0.08 }),
      onEachFeature: (feature, polygon) => {
        const label = document.createElement('span');
        label.textContent = geometry ? district.name : `${year === 1952 ? `${feature.properties.Region} ${feature.properties.Nummer_historisch}` : feature.properties.Nummer}: ${feature.properties['WK Name'] ?? feature.properties.Name ?? feature.properties.name ?? ''}`;
        polygon.bindTooltip(label);
      },
    }).addTo(map);
    if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 12 });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [geometry, data, number, district.name, year]);
  if (!geometry && !shared) return <p className="text-xs text-muted-foreground">Kein bestätigter Grenzumriss für diesen Wahlkreis hinterlegt.</p>;
  return <div className="space-y-2">
    {shared && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={neighbors} onChange={event => setNeighbors(event.target.checked)} />Angrenzende Wahlkreise anzeigen</label>}
    {query.isFetching && <p role="status" className="text-xs">Lade Wahlkreisgrenzen …</p>}
    {query.error && <p role="alert" className="text-sm">Grenzen konnten nicht geladen werden. <button className="underline" onClick={() => void query.refetch()}>Erneut laden</button></p>}
    <div ref={container} className="h-72 w-full rounded-md border" aria-label={`Karte: ${district.name}`} />
    <HistoricalGeometryNotice year={year} />
  </div>;
}
