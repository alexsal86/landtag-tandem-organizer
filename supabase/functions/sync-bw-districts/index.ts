import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import proj4 from 'https://esm.sh/proj4@2.9.2'
import JSZip from 'https://esm.sh/jszip@3.10.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to flatten first exterior ring from Polygon/MultiPolygon
function flattenExteriorRing(coordinates: any): number[][] {
  try {
    // MultiPolygon: [polygons][rings][points][xy(z)]
    if (Array.isArray(coordinates[0][0][0])) {
      const firstRing = coordinates[0][0] as number[][];
      return firstRing.map((c) => [c[0], c[1]]);
    }
    // Polygon: [rings][points][xy(z)]
    const ring = coordinates[0] as number[][];
    return ring.map((c) => [c[0], c[1]]);
  } catch {
    return [];
  }
}

// Centroid of polygon ring (returns [lat, lng])
function calculateCentroid(coordinates: any): [number, number] {
  const ring = flattenExteriorRing(coordinates);
  if (!ring.length) return [49.0, 8.4];

  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const a = x0 * y1 - x1 * y0;
    area += a;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
  }
  area *= 0.5;
  if (!area) {
    const n = ring.length;
    const sx = ring.reduce((s, p) => s + p[0], 0);
    const sy = ring.reduce((s, p) => s + p[1], 0);
    return [sy / n, sx / n];
  }
  return [cy / (6 * area), cx / (6 * area)];
}

// Helper function to calculate polygon area (rough approximation)
function calculateArea(coordinates: any): number {
  const ring = flattenExteriorRing(coordinates);
  if (!ring.length) return 0;
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += (x1 * y2 - x2 * y1);
  }
  return Math.abs(area) / 2;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting Baden-Württemberg districts sync...');

    // 1. Load official GeoJSON data (ZIP) directly from StatLA BW
    console.log('Fetching official LTW 2021 GeoJSON data (ZIP)...');

    const officialZipUrl = 'https://www.statistik-bw.de/Wahlen/Landtag/Download/LTWahlkreise2021-BW_GEOJSON.zip';
    let geoJsonData: any = null;

    try {
      const zipRes = await fetch(officialZipUrl);
      if (!zipRes.ok) {
        throw new Error(`ZIP fetch failed: ${zipRes.status} ${zipRes.statusText}`);
      }
      const buf = await zipRes.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const entry = Object.values(zip.files).find((f: any) => f.name.toLowerCase().endsWith('.geojson') || f.name.toLowerCase().endsWith('.json')) as any;
      if (!entry) throw new Error('No .geojson found inside ZIP');
      const text = await entry.async('text');
      geoJsonData = JSON.parse(text);
      console.log(`Loaded official ZIP GeoJSON with ${geoJsonData.features?.length || 0} features`);
    } catch (e) {
      console.error('Failed to load official ZIP GeoJSON:', e);
      throw e;
    }

    // Reprojection: File uses Gauss-Krüger (EPSG:31467) per metadata; convert to WGS84
    const crsName: string | undefined = geoJsonData?.crs?.properties?.name;
    const m = crsName ? (crsName.match(/EPSG::(\d+)/i) || crsName.match(/EPSG:(\d+)/i)) : null;
    const epsg = m ? `EPSG:${m[1]}` : 'EPSG:31467';

    // Define German Gauss-Krüger proj definitions
    proj4.defs('EPSG:31466', '+proj=tmerc +lat_0=0 +lon_0=6 +k=1 +x_0=2500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs');
    proj4.defs('EPSG:31467', '+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs');
    proj4.defs('EPSG:31468', '+proj=tmerc +lat_0=0 +lon_0=12 +k=1 +x_0=4500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs');
    proj4.defs('EPSG:31469', '+proj=tmerc +lat_0=0 +lon_0=15 +k=1 +x_0=5500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs');

    const sourceDef = proj4.defs(epsg) ? epsg : 'EPSG:31467';

    console.log(`Using projection ${sourceDef} -> WGS84`);


    // 2. Process each district
    for (const feature of geoJsonData.features || []) {
      const properties = feature.properties || {};
      const geometry = feature.geometry;
      
      // Extract district number and name from official LTW 2021 GeoJSON properties (robust)
      const props = properties as Record<string, any>;
      const keys = Object.keys(props);
      const norm = (k: string) => k.replace(/\s+/g, '').toLowerCase();
      const numKey = keys.find(k => norm(k) === 'nummer');
      const nameKey = keys.find(k => norm(k) === 'wkname');
      const rawNumber = numKey ? props[numKey] : (props['WK_NR'] ?? props['WKR_NR'] ?? props['WKNR']);
      const rawName = nameKey ? props[nameKey] : (props['WK_NAME'] ?? props['WKR_NAME']);

      const districtNumber = rawNumber ? parseInt(String(rawNumber), 10) : undefined;
      let districtName = rawName ?? props['WK Name'];

      if (!districtNumber || !districtName) {
        console.warn('Skipping feature with missing district number or name:', properties);
        continue;
      }

      // Fix potential mojibake (e.g., GÃ¶ppingen -> Göppingen)
      try {
        districtName = decodeURIComponent(escape(String(districtName)));
      } catch {}

      console.log(`Processing Wahlkreis ${districtNumber}: ${districtName}`);

      // Reproject geometry to WGS84
      let reprojectedGeometry: any = geometry;
      try {
        if (geometry?.type === 'Polygon') {
          const rings = geometry.coordinates as any[];
          const newRings = rings.map((ring: any[]) => ring.map((coord: any[]) => {
            const [x, y] = coord;
            const [lon, lat] = proj4(sourceDef, 'WGS84', [x, y]);
            return [lon, lat];
          }));
          reprojectedGeometry = { type: 'Polygon', coordinates: newRings };
        } else if (geometry?.type === 'MultiPolygon') {
          const polys = geometry.coordinates as any[];
          const newPolys = polys.map((rings: any[]) => rings.map((ring: any[]) => ring.map((coord: any[]) => {
            const [x, y] = coord;
            const [lon, lat] = proj4(sourceDef, 'WGS84', [x, y]);
            return [lon, lat];
          })));
          reprojectedGeometry = { type: 'MultiPolygon', coordinates: newPolys };
        }
      } catch (e) {
        console.warn('Reprojection failed, keeping original geometry for district', districtNumber, e);
      }

      // Calculate centroid on reprojected geometry
      let centerCoordinates: [number, number] = [49.0, 8.4];
      let areaKm2: number | null = null;
      try {
        if (reprojectedGeometry?.coordinates) {
          centerCoordinates = calculateCentroid(reprojectedGeometry.coordinates);
        }
      } catch (error) {
        console.warn(`Failed to calculate centroid for district ${districtNumber}:`, error);
      }

      // Upsert district
      const { error: districtError } = await supabase
        .from('election_districts')
        .upsert({
          district_number: parseInt(districtNumber.toString()),
          district_name: districtName,
          region: 'Baden-Württemberg',
          boundaries: reprojectedGeometry,
          center_coordinates: {
            lat: centerCoordinates[0],
            lng: centerCoordinates[1]
          },
          area_km2: areaKm2,
          major_cities: properties.major_cities || [],
          website_url: `https://www.landtag-bw.de/de/der-landtag/wahlkreiskarte/wahlkreis-${districtNumber}`
        }, {
          onConflict: 'district_number',
          ignoreDuplicates: false
        });

      if (districtError) {
        console.error(`Error upserting district ${districtNumber}:`, districtError);
      } else {
        console.log(`Successfully upserted district ${districtNumber}: ${districtName}`);
      }
    }

    // 3. Municipality data will be loaded separately via CSV processing
    console.log('District sync completed. Use separate function for municipality data.');

    console.log('Baden-Württemberg districts sync completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Districts synchronized successfully',
        processed_features: geoJsonData.features?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error syncing districts:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});