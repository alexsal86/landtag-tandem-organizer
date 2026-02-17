import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OverpassElement {
  type: string;
  id: number;
  tags?: {
    name?: string;
    'name:de'?: string;
    population?: string;
    admin_level?: string;
  };
  members?: Array<{
    type: string;
    ref: number;
    role: string;
    lat?: number;
    lon?: number;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
  geometry?: Array<{ lat: number; lon: number }>;
}

// Generate soft pastel colors
function generateSoftColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 45 + Math.random() * 25; // 45-70%
  const lightness = 75 + Math.random() * 15;  // 75-90%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Calculate centroid from polygon coordinates
function calculateCentroid(coordinates: number[][][]): { lat: number; lng: number } {
  if (!coordinates || coordinates.length === 0 || coordinates[0].length === 0) {
    return { lat: 49.0069, lng: 8.4037 }; // Fallback to Karlsruhe center
  }

  const polygon = coordinates[0];
  let latSum = 0;
  let lngSum = 0;

  for (const [lng, lat] of polygon) {
    latSum += lat;
    lngSum += lng;
  }

  return {
    lat: latSum / polygon.length,
    lng: lngSum / polygon.length,
  };
}

// Convert Overpass geometry to GeoJSON
function convertToGeoJSON(element: OverpassElement): any {
  if (!element.members) {
    return null;
  }

  const coordinates: number[][][] = [];

  for (const member of element.members) {
    if (member.role === 'outer' && member.geometry) {
      const ring = member.geometry.map(point => [point.lon, point.lat]);
      if (ring.length > 0) {
        coordinates.push(ring);
      }
    }
  }

  if (coordinates.length === 0) {
    return null;
  }

  return {
    type: 'Polygon',
    coordinates: coordinates,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching Karlsruhe districts from Overpass API...');

    // Overpass API query for Karlsruhe districts (admin_level=10) AND city boundary (admin_level=6)
    const overpassQuery = `
      [out:json][timeout:60];
      area["name"="Karlsruhe"]["admin_level"="6"]->.searchArea;
      (
        relation(area.searchArea)["boundary"="administrative"]["admin_level"="10"];
        relation(area.searchArea)["place"="suburb"];
        relation(area.searchArea)["boundary"="administrative"]["admin_level"="6"]["name"="Karlsruhe"];
      );
      out geom;
    `;

    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const overpassResponse = await fetch(overpassUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (!overpassResponse.ok) {
      throw new Error(`Overpass API error: ${overpassResponse.statusText}`);
    }

    const overpassData = await overpassResponse.json();
    const elements = overpassData.elements || [];

    console.log(`Found ${elements.length} potential districts`);

    const districts: any[] = [];
    const seenNames = new Set<string>();

    for (const element of elements) {
      const name = element.tags?.name || element.tags?.['name:de'];
      
      if (!name || seenNames.has(name)) {
        continue;
      }

      const geoJson = convertToGeoJSON(element);
      if (!geoJson) {
        continue;
      }

      seenNames.add(name);

      // Check if this is the city boundary
      const isCityBoundary = element.tags?.admin_level === '6' && name === 'Karlsruhe';

      const centroid = calculateCentroid(geoJson.coordinates);
      const color = isCityBoundary ? '#000000' : generateSoftColor();
      const population = element.tags?.population ? parseInt(element.tags.population) : null;

      districts.push({
        name: isCityBoundary ? 'Karlsruhe (Stadtgrenze)' : name,
        boundaries: geoJson,
        center_coordinates: centroid,
        color,
        population,
        is_city_boundary: isCityBoundary,
      });

      console.log(`Processed ${isCityBoundary ? 'city boundary' : 'district'}: ${name}`);
    }

    console.log(`Inserting ${districts.length} districts into database...`);

    // Clear existing data
    await supabase.from('karlsruhe_districts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert new districts
    const { data, error } = await supabase
      .from('karlsruhe_districts')
      .insert(districts)
      .select();

    if (error) {
      throw error;
    }

    console.log(`Successfully inserted ${data?.length || 0} districts`);

    return new Response(
      JSON.stringify({
        success: true,
        count: data?.length || 0,
        districts: data,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching Karlsruhe districts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
