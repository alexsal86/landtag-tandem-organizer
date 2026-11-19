import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as L from 'leaflet';
import { decodeElectoralTopology, fetchGeometryAsset } from '@/utils/electoralTopology';
import { decodeLosslessAreaTopology } from '@/utils/losslessAreaTopology';
import { getPartyColor } from '../partyColors';
import type { LocalArea, LocalBallot } from './LocalElectionResults';

interface AreaProperties extends Record<string, unknown> {
  key: string;
  center: [number, number];
}

export function useLocalResultMap({
  map, number, areas, selectedKey, ballot, onSelect,
}: {
  map: L.Map | null;
  number?: number;
  areas?: LocalArea[];
  selectedKey?: string;
  ballot: LocalBallot;
  onSelect?: (key: string) => void;
}) {
  const { data: shapes, isError } = useQuery({
    queryKey: ['local-election-shapes-2026-v2', number],
    enabled: number != null,
    queryFn: async () => {
      const response = await fetchGeometryAsset(`/data/local-results-2026/areas-v2/${number}.bin`);
      const data = decodeLosslessAreaTopology(await response.arrayBuffer());
      return decodeElectoralTopology(data, 'areas') as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, AreaProperties>;
    },
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (!map || number == null || !shapes || !areas) return;
    const byKey = new Map(areas.map(area => [area.key, area]));
    const labels = L.layerGroup().addTo(map);
    const layer = L.geoJSON<AreaProperties, GeoJSON.MultiPolygon>(shapes, {
      pane: 'municipalityBoundaries',
      bubblingMouseEvents: false,
      style: feature => {
        const key = feature?.properties.key;
        const selected = key === selectedKey;
        return {
          className: selected ? 'bw-local-area-selected' : 'bw-local-area',
          color: selected ? '#fff' : '#f8fafc',
          opacity: selected ? 1 : 0.95,
          weight: selected ? 3.5 : 1.25,
          fillColor: getPartyColor(key ? byKey.get(key)?.winners?.[ballot] : undefined),
          fillOpacity: selected ? 0.96 : 0.78,
        };
      },
      onEachFeature: (feature, path) => {
        const area = byKey.get(feature.properties.key);
        if (!area) return;
        path.on('click', () => onSelect?.(area.key));
        if (area.key !== selectedKey) {
          const content = document.createElement('span');
          content.textContent = area.name;
          path.bindTooltip(content, { sticky: true });
        }
      },
    }).addTo(map);

    layer.eachLayer(path => {
      const polygon = path as L.Polygon;
      if (polygon.feature?.properties.key === selectedKey) polygon.bringToFront();
    });

    const updateLabels = () => {
      labels.clearLayers();
      const size = map.getSize();
      const occupied: L.Bounds[] = [];
      const features = [...shapes.features].sort((a, b) =>
        Number(b.properties.key === selectedKey) - Number(a.properties.key === selectedKey));
      for (const feature of features) {
        const { key, center } = feature.properties;
        const area = byKey.get(key);
        const selected = key === selectedKey;
        if (!area || (!selected && map.getZoom() < 10)) continue;
        const position = L.latLng(center[1], center[0]);
        const point = map.latLngToContainerPoint(position);
        const width = Math.min(210, area.name.length * 7 + 24);
        const bounds = L.bounds([point.x - width / 2, point.y - 13], [point.x + width / 2, point.y + 13]);
        if (!selected && (bounds.min!.x < 0 || bounds.max!.x > size.x ||
            bounds.min!.y < 0 || bounds.max!.y > size.y ||
            occupied.some(other => other.intersects(bounds)))) continue;
        occupied.push(bounds);
        const content = document.createElement('span');
        content.textContent = area.name;
        content.title = area.name;
        labels.addLayer(L.tooltip({
          permanent: true,
          direction: 'center',
          className: selected ? 'bw-local-area-label bw-local-area-label-selected' : 'bw-local-area-label',
          opacity: 1,
        }).setLatLng(position).setContent(content));
      }
    };
    updateLabels();
    map.on('moveend resize', updateLabels);

    return () => {
      map.off('moveend resize', updateLabels);
      labels.remove();
      layer.remove();
    };
  }, [map, number, shapes, areas, selectedKey, ballot, onSelect]);

  return { hasLocalShapes: number != null && Boolean(shapes) && Boolean(areas), localShapeError: isError };
}
