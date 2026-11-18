import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type * as Leaflet from 'leaflet';
import L from '@/lib/leafletRuntime';
import 'leaflet/dist/leaflet.css';
import '@/styles/leaflet-overrides.css';
import { loadElectoralDistrict } from '@/utils/electoralTopology';
import { ELECTORAL_DISTRICT_MANIFESTS } from '@/utils/electoralDistrictAsset';
import { historical1952Source, reconstructedGeometryAttribution } from '@/utils/electoralGeometryCatalog';
import { confirmedPeriodGeometryYear } from './periodGeometry';
import { HistoricalGeometryNotice } from './HistoricalGeometryNotice';
import type { ElectionPeriod, HistoricalDistrict } from './types';

type DistrictBoundaryMapProps =
  | { period: ElectionPeriod | undefined; district: HistoricalDistrict }
  | { analysis: {
    year: number;
    number: number;
    name: string;
    bundledYear: number | null;
    boundaries: HistoricalDistrict['boundaries'];
    geometrySourceKey?: string | null;
  } };

export default function DistrictBoundaryMap(props: DistrictBoundaryMapProps) {
  const period = 'period' in props ? props.period : undefined;
  const district = 'district' in props ? props.district : {
    name: props.analysis.name,
    district_number: props.analysis.number,
    geometry_source_key: props.analysis.geometrySourceKey,
    boundaries: props.analysis.boundaries,
  };

  const [neighbors, setNeighbors] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const selectedBounds = useRef<Leaflet.LatLngBounds | null>(null);
  const neighborLayer = useRef<Leaflet.GeoJSON | null>(null);
  const electionYear = 'analysis' in props ? props.analysis.year : period?.election_year;
  const year = 'analysis' in props
    ? props.analysis.bundledYear
    : confirmedPeriodGeometryYear(period);
  const number = electionYear === 1952
    ? historical1952Source(district.geometry_source_key)?.technicalNumber ?? null
    : district.district_number;
  // Individually supplied geometry always takes precedence; it has no inferred neighbors.
  const shared = !district.boundaries && year !== null && number !== null;
  const query = useQuery({
    queryKey: ['district-boundary', year === null ? null : ELECTORAL_DISTRICT_MANIFESTS[year], number, false],
    enabled: shared,
    queryFn: () => loadElectoralDistrict(year!, number!, false),
    staleTime: Infinity, gcTime: 300_000, retry: false,
  });
  // Warm surrounding source polygons after the selected shape is available.
  // Their data never replaces the selected query or the Leaflet instance.
  const surroundings = useQuery({
    queryKey: ['district-boundary', year === null ? null : ELECTORAL_DISTRICT_MANIFESTS[year], number, 'surroundings'],
    enabled: shared && query.isSuccess,
    queryFn: () => loadElectoralDistrict(year!, number!, true),
    staleTime: Infinity, gcTime: 300_000, retry: false,
  });
  const geometry = district.boundaries;
  const data = query.data;
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false });
    mapRef.current = map;
    map.createPane('district-focus');
    map.getPane('district-focus')!.style.zIndex = '450';
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    const attribution = reconstructedGeometryAttribution(year);
    if (attribution) map.attributionControl.addAttribution(attribution);
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      // The details/sidebar can resize after its first layout. Refit the full
      // selected boundary at that size, rather than leaving its west edge clipped.
      if (selectedBounds.current?.isValid()) map.fitBounds(selectedBounds.current, { padding: [28, 28], maxZoom: 12, animate: false });
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect(); map.remove(); mapRef.current = null;
      selectedBounds.current = null; neighborLayer.current = null;
    };
  }, [year, number]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || (!geometry && !data)) return;
    const collection = geometry ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { Nummer: number, Name: district.name }, geometry }] } : data;
    const layer = L.geoJSON(collection as GeoJSON.GeoJsonObject, {
      pane: 'district-focus',
      // @ts-expect-error Leaflet supports noClip at runtime, but @types/leaflet omits it from PathOptions.
      style: { color: '#15803d', weight: 3, opacity: 1, fillOpacity: 0.25, noClip: true, smoothFactor: 0 },
      onEachFeature: (feature, polygon) => {
        const label = document.createElement('span');
        label.textContent = geometry ? district.name : `${year === 1952 ? `${feature.properties.Region} ${feature.properties.Nummer_historisch}` : feature.properties.Nummer}: ${feature.properties['WK Name'] ?? feature.properties.Name ?? feature.properties.name ?? ''}`;
        polygon.bindTooltip(label);
      },
    }).addTo(map);
    const bounds = layer.getBounds();
    selectedBounds.current = bounds;
    map.invalidateSize({ pan: false });
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12, animate: false });
    return () => { layer.remove(); selectedBounds.current = null; };
  }, [geometry, data, number, district.name, year]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !surroundings.data) return;
    const layer = L.geoJSON(surroundings.data as GeoJSON.GeoJsonObject, {
      filter: feature => Number(feature.properties?.Nummer) !== number,
      style: { color: '#64748b', weight: 1.5, fillOpacity: 0.08 },
      onEachFeature: (feature, polygon) => {
        const label = document.createElement('span');
        label.textContent = `${year === 1952 ? `${feature.properties.Region} ${feature.properties.Nummer_historisch}` : feature.properties.Nummer}: ${feature.properties['WK Name'] ?? feature.properties.Name ?? ''}`;
        polygon.bindTooltip(label);
      },
    });
    neighborLayer.current = layer;
    return () => { layer.remove(); neighborLayer.current = null; };
  }, [surroundings.data, year, number]);
  useEffect(() => {
    const map = mapRef.current;
    const layer = neighborLayer.current;
    if (!map || !layer) return;
    if (neighbors) layer.addTo(map);
    else layer.remove();
  }, [neighbors, surroundings.data, year, number]);
  if (!geometry && !shared) return <p className="text-xs text-muted-foreground">{electionYear === 1952
    ? 'Für diesen Wahlkreis fehlt die eindeutige regionale Kartenzuordnung von 1952.'
    : 'Kein Grenzumriss für diesen Wahlkreis hinterlegt.'}</p>;
  return <div className="space-y-2">
    {shared && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={neighbors} onChange={event => setNeighbors(event.target.checked)} />Umliegende Wahlkreise anzeigen</label>}
    {neighbors && surroundings.isFetching && <p role="status" className="text-xs">Lade umliegende Wahlkreise …</p>}
    {neighbors && surroundings.error && <p role="alert" className="text-sm">Nachbargrenzen konnten nicht geladen werden. <button className="underline" onClick={() => void surroundings.refetch()}>Erneut laden</button></p>}
    {query.isFetching && <p role="status" className="text-xs">Lade Wahlkreisgrenzen …</p>}
    {query.error && <p role="alert" className="text-sm">Grenzen konnten nicht geladen werden. <button className="underline" onClick={() => void query.refetch()}>Erneut laden</button></p>}
    <div ref={container} className="h-72 w-full rounded-md border" aria-label={`Karte: ${district.name}`} />
    <HistoricalGeometryNotice year={year} />
  </div>;
}
