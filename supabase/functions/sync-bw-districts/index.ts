import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to calculate polygon centroid
function calculateCentroid(coordinates: number[][][]): [number, number] {
  let totalLat = 0;
  let totalLng = 0;
  let totalPoints = 0;

  // Handle MultiPolygon by processing first polygon
  const polygon = coordinates[0];
  
  for (const point of polygon) {
    totalLng += point[0];
    totalLat += point[1];
    totalPoints++;
  }

  return [totalLat / totalPoints, totalLng / totalPoints];
}

// Helper function to calculate polygon area (rough approximation)
function calculateArea(coordinates: number[][][]): number {
  const polygon = coordinates[0];
  let area = 0;
  
  for (let i = 0; i < polygon.length - 1; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[i + 1];
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
    
    // Load the actual LTW 2021 GeoJSON file from public data folder
    const geoJsonResponse = await fetch('https://wawofclbehbkebjivdte.supabase.co/storage/v1/object/public/data/LTWahlkreise2021-BW.geojson');
    
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
      
      // Extract district number and name from official LTW 2021 GeoJSON properties
      const districtNumber = properties.Nummer;
      const districtName = properties['WK Name'];
      
      if (!districtNumber || !districtName) {
        console.warn('Skipping feature with missing district number or name:', properties);
        continue;
      }

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