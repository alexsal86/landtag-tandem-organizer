import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeoJSONFeature {
  type: string;
  properties: {
    STADTTEIL?: string;
    name?: string;
    [key: string]: any;
  };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJSONData {
  type: string;
  features: GeoJSONFeature[];
}

// Generate soft pastel colors
function generateSoftColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 60 + Math.floor(Math.random() * 20); // 60-80%
  const lightness = 75 + Math.floor(Math.random() * 10); // 75-85%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Calculate centroid of a polygon
function calculateCentroid(coordinates: number[][][]): { lat: number; lng: number } {
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  // Use first polygon if MultiPolygon
  const polygon = coordinates[0];
  
  for (const [lng, lat] of polygon) {
    sumLat += lat;
    sumLng += lng;
    count++;
  }

  return {
    lat: sumLat / count,
    lng: sumLng / count
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching GeoJSON from GitHub raw content...');
    
    // Fetch the GeoJSON file from GitHub raw content
    const geoJsonUrl = `https://raw.githubusercontent.com/alexsal86/landtag-tandem-organizer/main/public/data/karlsruhe-stadtteile.geojson`;
    const response = await fetch(geoJsonUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Supabase-Edge-Function'
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch GeoJSON:', response.status, response.statusText);
      throw new Error(`Failed to fetch GeoJSON: ${response.status} ${response.statusText}`);
    }

    const geoJson: GeoJSONData = await response.json();
    console.log(`Found ${geoJson.features.length} features in GeoJSON`);

    const districts = [];

    for (const feature of geoJson.features) {
      // Skip if not a Polygon or MultiPolygon
      if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
        continue;
      }

      console.log(`Processing feature properties:`, JSON.stringify(feature.properties));

      // Get district name from properties (checking NAME first for karlsruhe-stadtteile.geojson)
      const name = feature.properties.NAME || feature.properties.name || feature.properties.STADTTEIL;
      if (!name) {
        console.log('Skipping feature without name:', feature.properties);
        continue;
      }

      // Calculate centroid for label placement
      let coordinates: number[][][];
      if (feature.geometry.type === 'Polygon') {
        coordinates = [feature.geometry.coordinates as number[][][]];
      } else {
        coordinates = feature.geometry.coordinates as number[][][][];
      }

      const centroid = calculateCentroid(coordinates[0]);

      // Convert to GeoJSON format for storage
      const boundaries = {
        type: feature.geometry.type,
        coordinates: feature.geometry.coordinates
      };

      districts.push({
        name,
        boundaries,
        center_coordinates: centroid,
        color: generateSoftColor(),
        is_city_boundary: false,
        area_km2: null,
        population: null
      });

      console.log(`Processed district: ${name}`);
    }

    // Clear existing districts
    const { error: deleteError } = await supabaseClient
      .from('karlsruhe_districts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('Error clearing districts:', deleteError);
    }

    // Insert new districts
    console.log(`Inserting ${districts.length} districts into database...`);
    const { data, error } = await supabaseClient
      .from('karlsruhe_districts')
      .insert(districts)
      .select();

    if (error) {
      throw error;
    }

    console.log(`Successfully inserted ${districts.length} districts`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${districts.length} districts from official GeoJSON`,
        districts: data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error importing districts:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
