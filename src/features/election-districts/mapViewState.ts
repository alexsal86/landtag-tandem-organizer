/**
 * The map view is shareable: legislature, selected district, layers, party
 * filter and viewport live in the URL, the way the research workbench keeps its
 * state. Reloads, copied links and browser back/forward therefore restore the
 * same map instead of resetting to defaults.
 */
export type MapLayers = {
  districts: boolean;
  polygons: boolean;
  markers: boolean;
  administrative: boolean;
  partyAssociations: boolean;
  baseMap: boolean;
};

export type MapViewport = {
  center: { lat: number; lng: number };
  zoom: number;
};

export type MapViewState = {
  periodId: string | null;
  districtId: string | null;
  layers: MapLayers;
  parties: string[] | null;
  viewport: MapViewport | null;
  mode: 'karte' | 'kartogramm';
  embed: boolean;
};

export const defaultMapLayers: MapLayers = {
  districts: true,
  polygons: true,
  markers: true,
  administrative: false,
  partyAssociations: false,
  baseMap: false,
};

const LAYER_CODES: Record<keyof MapLayers, string> = {
  districts: 'wk',
  polygons: 'fl',
  markers: 'nr',
  administrative: 'vg',
  partyAssociations: 'kv',
  baseMap: 'osm',
};

const layerKeys = Object.keys(LAYER_CODES) as (keyof MapLayers)[];

const numberInRange = (value: string | undefined, min: number, max: number): number | null => {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

const decodeViewport = (raw: string | null): MapViewport | null => {
  if (!raw) return null;
  const [lat, lng, zoom] = raw.split(',');
  const latitude = numberInRange(lat, -90, 90);
  const longitude = numberInRange(lng, -180, 180);
  const level = numberInRange(zoom, 1, 22);
  if (latitude == null || longitude == null || level == null) return null;
  return { center: { lat: latitude, lng: longitude }, zoom: level };
};

const decodeLayers = (raw: string | null): MapLayers => {
  if (raw == null) return { ...defaultMapLayers };
  const codes = new Set(raw.split(',').map(code => code.trim()).filter(Boolean));
  const layers = { ...defaultMapLayers };
  for (const key of layerKeys) layers[key] = codes.has(LAYER_CODES[key]);
  return layers;
};

export const decodeMapViewState = (params: URLSearchParams): MapViewState => {
  const parties = params.get('parteien');
  return {
    periodId: params.get('periode') || null,
    districtId: params.get('wk') || null,
    layers: decodeLayers(params.get('ebenen')),
    parties: parties ? parties.split(',').map(party => party.trim()).filter(Boolean) : null,
    viewport: decodeViewport(params.get('karte')),
    mode: params.get('ansicht') === 'kartogramm' ? 'kartogramm' : 'karte',
    embed: params.get('embed') === '1' || params.get('embed') === 'true',
  };
};

const setOrDelete = (params: URLSearchParams, key: string, value: string | null) => {
  if (value) params.set(key, value);
  else params.delete(key);
};

/** Rewrites only the map parameters; unrelated ones such as `tab` survive. */
export const encodeMapViewState = (current: URLSearchParams, state: MapViewState): URLSearchParams => {
  const next = new URLSearchParams(current);
  setOrDelete(next, 'periode', state.periodId);
  setOrDelete(next, 'wk', state.districtId);

  const activeCodes = layerKeys.filter(key => state.layers[key]).map(key => LAYER_CODES[key]);
  const defaultCodes = layerKeys.filter(key => defaultMapLayers[key]).map(key => LAYER_CODES[key]);
  if (activeCodes.join(',') === defaultCodes.join(',')) next.delete('ebenen');
  else next.set('ebenen', activeCodes.join(','));

  setOrDelete(next, 'parteien', state.parties && state.parties.length > 0 ? state.parties.join(',') : null);

  if (state.viewport) {
    const { lat, lng } = state.viewport.center;
    next.set('karte', `${lat.toFixed(4)},${lng.toFixed(4)},${state.viewport.zoom.toFixed(1)}`);
  } else {
    next.delete('karte');
  }

  setOrDelete(next, 'ansicht', state.mode === 'kartogramm' ? 'kartogramm' : null);

  if (state.embed) next.set('embed', '1');
  else next.delete('embed');

  return next;
};
