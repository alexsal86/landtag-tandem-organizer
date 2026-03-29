import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapLayer } from '@/hooks/useMapLayers';
import { useGeoJsonLayer } from '@/hooks/useGeoJsonLayer';
import { Feature } from '@/types/geoDomain';

interface DynamicGeoJsonLayerProps {
  map: L.Map | null;
  layer: MapLayer;
  visible: boolean;
}

/**
 * Renders a single dynamic GeoJSON layer on the Leaflet map.
 * Each layer is independently loaded and cached.
 */
export const DynamicGeoJsonLayer = ({ map, layer, visible }: DynamicGeoJsonLayerProps) => {
  const leafletLayerRef = useRef<L.GeoJSON | null>(null);

  const { data: features = [] } = useGeoJsonLayer(
    layer.source_type,
    layer.source_path,
    visible && !!map
  );

  useEffect(() => {
    if (!map) return;

    // Remove existing layer
    if (leafletLayerRef.current) {
      leafletLayerRef.current.remove();
      leafletLayerRef.current = null;
    }

    if (!visible || features.length === 0) return;

    const geojsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: features.map(f => ({
        type: 'Feature' as const,
        properties: f.properties,
        geometry: f.geometry as GeoJSON.Geometry,
      })),
    };

    const leafletLayer = L.geoJSON(geojsonData, {
      style: () => ({
        color: layer.stroke_color,
        weight: layer.stroke_width,
        fillColor: layer.fill_color,
        fillOpacity: layer.fill_opacity,
        dashArray: layer.stroke_dash_array || undefined,
      }),
      onEachFeature: (feature, featureLayer) => {
        if (!layer.label_property || !feature.properties) return;
        const label = feature.properties[layer.label_property];
        if (label) {
          featureLayer.bindPopup(`
            <div style="font-family: sans-serif;">
              <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">${label}</h3>
              <p style="margin: 0; font-size: 12px; color: #666;">${layer.name}</p>
            </div>
          `);
        }
      },
    }).addTo(map);

    leafletLayerRef.current = leafletLayer;

    return () => {
      if (leafletLayerRef.current) {
        leafletLayerRef.current.remove();
        leafletLayerRef.current = null;
      }
    };
  }, [map, visible, features, layer]);

  return null;
};

interface DynamicGeoJsonLayersProps {
  map: L.Map | null;
  layers: MapLayer[];
  visibleLayerIds: Set<string>;
}

/**
 * Container that renders all dynamic GeoJSON layers.
 */
export const DynamicGeoJsonLayers = ({ map, layers, visibleLayerIds }: DynamicGeoJsonLayersProps) => {
  return (
    <>
      {layers.map(layer => (
        <DynamicGeoJsonLayer
          key={layer.id}
          map={map}
          layer={layer}
          visible={visibleLayerIds.has(layer.id)}
        />
      ))}
    </>
  );
};
