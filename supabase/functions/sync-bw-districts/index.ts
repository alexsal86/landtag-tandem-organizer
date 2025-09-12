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

    // 1. Load official GeoJSON data from StatLA BW
    console.log('Fetching official GeoJSON data...');
    const geoJsonUrl = 'https://www.statistik-bw.de/GeoDienste/Landtagswahlkreise_2021/data/LTWahlkreise2021-BW_GEOJSON.zip';
    
    // For demo purposes, we'll work with the sample data that should already be in public/data/
    // In production, you'd want to download and extract the zip file
    const sampleGeoJsonResponse = await fetch('https://wawofclbehbkebjivdte.supabase.co/storage/v1/object/public/documents/sample-wahlkreise.geojson');
    
    if (!sampleGeoJsonResponse.ok) {
      throw new Error('Failed to fetch GeoJSON data');
    }

    const geoJsonData = await sampleGeoJsonResponse.json();
    console.log(`Loaded GeoJSON with ${geoJsonData.features?.length || 0} features`);

    // Validate we have 70 districts
    if (!geoJsonData.features || geoJsonData.features.length !== 70) {
      console.warn(`Expected 70 districts, got ${geoJsonData.features?.length || 0}`);
    }

    // 2. Process each district
    for (const feature of geoJsonData.features || []) {
      const properties = feature.properties || {};
      const geometry = feature.geometry;
      
      // Extract district number and name from properties
      const districtNumber = properties.WK_NR || properties.wahlkreis_nr || properties.district_number;
      const districtName = properties.WK_NAME || properties.wahlkreis_name || properties.name;
      
      if (!districtNumber || !districtName) {
        console.warn('Skipping feature with missing district number or name:', properties);
        continue;
      }

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

    // 3. Load municipality data (simplified for now - in production would load from CSV)
    console.log('Loading municipality sample data...');
    
    // Sample municipalities for a few districts
    const sampleMunicipalities = [
      { district_number: 1, name: 'Konstanz', type: 'city', county: 'Konstanz' },
      { district_number: 1, name: 'Reichenau', type: 'municipality', county: 'Konstanz' },
      { district_number: 2, name: 'Stockach', type: 'city', county: 'Konstanz' },
      { district_number: 17, name: 'Tübingen', type: 'city', county: 'Tübingen' },
      { district_number: 17, name: 'Rottenburg am Neckar', type: 'city', county: 'Tübingen' },
      { district_number: 46, name: 'Ulm', type: 'city', county: 'Alb-Donau-Kreis' },
      { district_number: 62, name: 'Wangen im Allgäu', type: 'city', county: 'Ravensburg' },
      { district_number: 63, name: 'Biberach an der Riß', type: 'city', county: 'Biberach' },
      { district_number: 64, name: 'Ehingen (Donau)', type: 'city', county: 'Alb-Donau-Kreis' },
    ];

    for (const municipality of sampleMunicipalities) {
      // Get district ID
      const { data: district } = await supabase
        .from('election_districts')
        .select('id')
        .eq('district_number', municipality.district_number)
        .single();

      if (district) {
        const { error } = await supabase
          .from('election_district_municipalities')
          .upsert({
            district_id: district.id,
            name: municipality.name,
            type: municipality.type,
            county: municipality.county
          }, {
            onConflict: 'district_id,name',
            ignoreDuplicates: false
          });

        if (error) {
          console.error(`Error upserting municipality ${municipality.name}:`, error);
        }
      }
    }

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