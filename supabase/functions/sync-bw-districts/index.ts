import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // 1. Load official GeoJSON data from public folder
    console.log('Fetching official LTW 2021 GeoJSON data...');
    
    // Try fetching from 'data' bucket first, then fallback to 'documents'
    const primaryUrl = 'https://wawofclbehbkebjivdte.supabase.co/storage/v1/object/public/data/LTWahlkreise2021-BW.geojson';
    const fallbackUrl = 'https://wawofclbehbkebjivdte.supabase.co/storage/v1/object/public/documents/LTWahlkreise2021-BW.geojson';

    let geoJsonResponse = await fetch(primaryUrl);
    if (!geoJsonResponse.ok) {
      console.warn('Primary GeoJSON fetch failed, trying fallback...', geoJsonResponse.status, geoJsonResponse.statusText);
      geoJsonResponse = await fetch(fallbackUrl);
    }
    
    if (!geoJsonResponse.ok) {
      console.error('Failed to fetch GeoJSON:', geoJsonResponse.status, geoJsonResponse.statusText);
      throw new Error(`Failed to fetch GeoJSON data: ${geoJsonResponse.status}`);
    }

    const geoJsonData = await geoJsonResponse.json();
    console.log(`Loaded GeoJSON with ${geoJsonData.features?.length || 0} features`);

    // Validate we have 70 districts
    if (!geoJsonData.features || geoJsonData.features.length !== 70) {
      console.warn(`Expected 70 districts, got ${geoJsonData.features?.length || 0}`);
    }

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

      // Calculate centroid
      let centerCoordinates: [number, number] = [49.0, 8.4]; // Default to center of BW
      let areaKm2: number | null = null;

      if (geometry && geometry.coordinates) {
        try {
          centerCoordinates = calculateCentroid(geometry.coordinates);
          areaKm2 = calculateArea(geometry.coordinates);
        } catch (error) {
          console.warn(`Failed to calculate centroid for district ${districtNumber}:`, error);
        }
      }

      // Upsert district
      const { error: districtError } = await supabase
        .from('election_districts')
        .upsert({
          district_number: parseInt(districtNumber.toString()),
          district_name: districtName,
          region: 'Baden-Württemberg',
          boundaries: geometry,
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