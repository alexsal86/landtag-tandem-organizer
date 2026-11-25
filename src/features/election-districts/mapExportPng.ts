import type { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { directMandateParty, electionDistrictNumberLabel, hasRenderableBoundary, partyColors } from './mapModel';

/**
 * Renders the district map as a standalone PNG. The live map draws numbers as
 * divIcons, which cannot be serialised from the DOM, so this builds its own SVG
 * from the district geometries, rasterises it and triggers a download.
 */

export type MapExportLegendItem = { party: string; label: string; count: number };

export type MapExportOptions = {
  districts: ElectionDistrict[];
  parties?: Set<string>;
  legend: MapExportLegendItem[];
  title: string;
  standLabel?: string;
  sourceLabel?: string;
  selectedDistrictId?: string;
  fileName: string;
};

type Ring = [number, number][];

const PAGE_WIDTH = 2000;
const MARGIN = 48;
const HEADER_HEIGHT = 104;
const LEGEND_WIDTH = 380;
const GAP = 36;
const MAX_MAP_HEIGHT = 1500;
const FOOTER_HEIGHT = 76;
const FONT = 'Helvetica Neue, Arial, sans-serif';
const PIXEL_RATIO = 2;

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const ringsOf = (district: ElectionDistrict): Ring[] => {
  if (!hasRenderableBoundary(district.boundaries)) return [];
  const geometry = district.boundaries as { type: string; coordinates: unknown };
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  if (!Array.isArray(polygons)) return [];
  return (polygons as unknown[])
    .filter(Array.isArray)
    .flatMap(polygon => (polygon as unknown[]).filter(Array.isArray) as Ring[])
    .map(ring => ring.filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])))
    .filter(ring => ring.length >= 3);
};

const centroidOf = (rings: Ring[]): { lng: number; lat: number } | null => {
  const ring = rings.reduce<Ring | null>((largest, current) => (!largest || current.length > largest.length ? current : largest), null);
  if (!ring?.length) return null;
  let lng = 0;
  let lat = 0;
  for (const point of ring) {
    lng += point[0];
    lat += point[1];
  }
  return { lng: lng / ring.length, lat: lat / ring.length };
};

const labelAnchor = (district: ElectionDistrict, rings: Ring[]) => {
  const center = district.center_coordinates as { lat?: number; lng?: number } | null | undefined;
  if (typeof center?.lat === 'number' && typeof center?.lng === 'number' && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
    return { lat: center.lat, lng: center.lng };
  }
  return centroidOf(rings);
};

export function buildDistrictMapSvg(options: MapExportOptions): { svg: string; width: number; height: number } {
  const { districts, parties, legend, title, standLabel, sourceLabel, selectedDistrictId } = options;
  const drawable = districts
    .filter(district => district.district_type !== 'verwaltungsgrenze')
    .map(district => ({ district, rings: ringsOf(district) }))
    .filter(entry => entry.rings.length > 0);
  if (!drawable.length) throw new Error('Keine Wahlkreisflächen mit Grenzdaten vorhanden');

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const { rings } of drawable) {
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  if (![minLng, maxLng, minLat, maxLat].every(Number.isFinite)) throw new Error('Grenzdaten ohne gültige Koordinaten');

  // Latitude-corrected plane projection: accurate enough for one federal state and
  // it keeps offline rendering independent from the map library.
  const cos = Math.max(0.2, Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180));
  const projectX = (lng: number) => lng * cos;
  const projectY = (lat: number) => -lat;
  const spanX = Math.max(projectX(maxLng) - projectX(minLng), 1e-6);
  const spanY = Math.max(projectY(minLat) - projectY(maxLat), 1e-6);

  const mapLeft = MARGIN;
  const mapTop = MARGIN + HEADER_HEIGHT;
  const mapWidth = PAGE_WIDTH - MARGIN * 2 - LEGEND_WIDTH - GAP;
  let scale = mapWidth / spanX;
  if (spanY * scale > MAX_MAP_HEIGHT) scale = MAX_MAP_HEIGHT / spanY;
  const mapHeight = Math.max(340, Math.round(spanY * scale));
  const offsetX = mapLeft + (mapWidth - spanX * scale) / 2;
  const offsetY = mapTop + (mapHeight - spanY * scale) / 2;
  const project = (lng: number, lat: number): [number, number] => [
    offsetX + (projectX(lng) - projectX(minLng)) * scale,
    offsetY + (projectY(lat) - projectY(maxLat)) * scale,
  ];

  const pageHeight = Math.round(mapTop + mapHeight + FOOTER_HEIGHT + MARGIN);
  const legendLeft = PAGE_WIDTH - MARGIN - LEGEND_WIDTH;
  const missing = districts.filter(district => district.district_type !== 'verwaltungsgrenze' && !hasRenderableBoundary(district.boundaries)).length;

  const shapes = drawable.map(({ district, rings }) => {
    const party = directMandateParty(district);
    const active = !parties || parties.has(party);
    const selected = district.id === selectedDistrictId;
    const path = rings
      .map(ring => `${ring.map(([lng, lat], index) => `${index === 0 ? 'M' : 'L'}${project(lng, lat).map(value => value.toFixed(1)).join(',')}`).join('')}Z`)
      .join('');
    const fill = active ? (partyColors[party] || '#9ca3af') : '#ffffff';
    const stroke = selected ? '#2563eb' : active ? '#ffffff' : '#8b9384';
    const strokeWidth = selected ? 4 : active ? 1.4 : 1;
    const opacity = active ? 0.78 : 0.9;
    return `<path d="${path}" fill="${fill}" fill-opacity="${opacity}" fill-rule="evenodd" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`;
  });

  const numberFont = Math.min(15, Math.max(10, Math.round(mapWidth / 110)));
  const labels = drawable.map(({ district, rings }) => {
    if (!(district.district_number > 0)) return '';
    const anchor = labelAnchor(district, rings);
    if (!anchor) return '';
    const [x, y] = project(anchor.lng, anchor.lat);
    const party = directMandateParty(district);
    const active = !parties || parties.has(party);
    const color = active ? partyColors[party] || '#9ca3af' : '#8b9384';
    const text = electionDistrictNumberLabel(district);
    const width = Math.max(numberFont * 2 + 6, text.length * numberFont * 0.62 + 10);
    const height = numberFont * 1.8;
    const opacity = active ? 1 : 0.75;
    return `<g opacity="${opacity}">`
      + `<rect x="${(x - width / 2).toFixed(1)}" y="${(y - height / 2).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="${(height / 2).toFixed(1)}" fill="#ffffff" stroke="${color}" stroke-width="2.4" />`
      + `<text x="${x.toFixed(1)}" y="${(y + numberFont * 0.36).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${numberFont}" font-weight="700" fill="#111111">${escapeXml(text)}</text>`
      + '</g>';
  }).join('');

  const legendRows = legend.map((item, index) => {
    const y = mapTop + 62 + index * 38;
    return `<g>`
      + `<rect x="${legendLeft}" y="${y - 15}" width="22" height="22" rx="3" fill="${partyColors[item.party] || '#9ca3af'}" stroke="#000000" stroke-opacity="0.18" />`
      + `<text x="${legendLeft + 34}" y="${y + 2}" font-family="${FONT}" font-size="21" fill="#1f2418">${escapeXml(item.label)}</text>`
      + `<text x="${legendLeft + LEGEND_WIDTH}" y="${y + 2}" text-anchor="end" font-family="${FONT}" font-size="20" fill="#5a6350">${item.count}</text>`
      + '</g>';
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${pageHeight}" viewBox="0 0 ${PAGE_WIDTH} ${pageHeight}">`
    + `<rect width="${PAGE_WIDTH}" height="${pageHeight}" fill="#ffffff" />`
    + `<text x="${MARGIN}" y="${MARGIN + 34}" font-family="${FONT}" font-size="40" font-weight="700" fill="#1f2418">${escapeXml(title)}</text>`
    + (standLabel ? `<text x="${MARGIN}" y="${MARGIN + 72}" font-family="${FONT}" font-size="22" fill="#5a6350">${escapeXml(standLabel)}</text>` : '')
    + `<rect x="${mapLeft}" y="${mapTop}" width="${mapWidth}" height="${mapHeight}" rx="6" fill="#e9ede2" />`
    + `<clipPath id="map-clip"><rect x="${mapLeft}" y="${mapTop}" width="${mapWidth}" height="${mapHeight}" rx="6" /></clipPath>`
    + `<g clip-path="url(#map-clip)">${shapes.join('')}${labels}</g>`
    + `<line x1="${legendLeft}" y1="${mapTop + 22}" x2="${legendLeft + LEGEND_WIDTH}" y2="${mapTop + 22}" stroke="#d5dac9" />`
    + `<text x="${legendLeft}" y="${mapTop + 18}" font-family="${FONT}" font-size="20" font-weight="700" fill="#1f2418">Legende</text>`
    + legendRows
    + `<line x1="${legendLeft}" y1="${mapTop + 62 + legend.length * 38}" x2="${legendLeft + LEGEND_WIDTH}" y2="${mapTop + 62 + legend.length * 38}" stroke="#d5dac9" />`
    + `<text x="${legendLeft}" y="${mapTop + 92 + legend.length * 38}" font-family="${FONT}" font-size="18" fill="#5a6350">Farbe = Partei des Direktmandats</text>`
    + `<text x="${legendLeft}" y="${mapTop + 116 + legend.length * 38}" font-family="${FONT}" font-size="18" fill="#5a6350">Nummer = Wahlkreisnummer</text>`
    + (sourceLabel ? `<text x="${MARGIN}" y="${pageHeight - MARGIN + 6}" font-family="${FONT}" font-size="18" fill="#3f4938">${escapeXml(sourceLabel)}</text>` : '')
    + (missing > 0 ? `<text x="${MARGIN}" y="${pageHeight - MARGIN + 32}" font-family="${FONT}" font-size="17" fill="#7a5b16">${missing} Gebiete ohne Grenzdaten nicht dargestellt.</text>` : '')
    + '</svg>';

  return { svg, width: PAGE_WIDTH, height: pageHeight };
}

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('SVG konnte nicht gerastert werden'));
  image.src = url;
});

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Canvas konnte nicht als PNG geschrieben werden'))), 'image/png');
});

/** Draws the export SVG into a canvas and saves it as a PNG download. */
export async function exportDistrictMapPng(options: MapExportOptions): Promise<void> {
  const { svg, width, height } = buildDistrictMapSvg(options);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = width * PIXEL_RATIO;
    canvas.height = height * PIXEL_RATIO;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Zeichenfläche nicht verfügbar');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas);
    const downloadUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = options.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(downloadUrl);
    }
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
