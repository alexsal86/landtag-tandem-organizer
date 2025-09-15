import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let geoJsonData: any;

    try {
      // Try to get GeoJSON from request body first
      const body = await req.json();
      if (body.geoJsonData) {
        geoJsonData = body.geoJsonData;
        console.log('Using GeoJSON data from request body');
      }
    } catch (error) {
      console.log('No valid JSON in request body, trying local file');
    }

    // If no data in request, try to load from local file
    if (!geoJsonData) {
      try {
        const geoJsonText = await Deno.readTextFile('/var/task/public/data/kreise_bw.json');
        geoJsonData = JSON.parse(geoJsonText);
        console.log('Loaded GeoJSON data from local file');
      } catch (error) {
        console.error('Error loading local GeoJSON file:', error);
        return new Response(
          JSON.stringify({ error: 'Could not load GeoJSON data from request or local file', details: error.message }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    if (!geoJsonData || !geoJsonData.features) {
      return new Response(
        JSON.stringify({ error: 'Invalid GeoJSON data structure' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Clear existing administrative boundaries
    const { error: deleteError } = await supabaseClient
      .from('election_districts')
      .delete()
      .eq('district_type', 'verwaltungsgrenze');

    if (deleteError) {
      console.error('Error clearing existing administrative boundaries:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to clear existing data', details: deleteError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing ${geoJsonData.features.length} administrative boundary features`);

    const processedFeatures = geoJsonData.features.map((feature: any) => {
      const geometry = feature.geometry;
      const properties = feature.properties;

      // Calculate centroid for MultiPolygon
      const centroid = calculateCentroid(geometry);

      return {
        district_number: properties.kreis_id || 0,
        district_name: properties.kreis_name || 'Unbekannt',
        district_type: 'verwaltungsgrenze',
        administrative_level: 'kreis',
        region: properties.regierun_1 || 'Baden-Württemberg',
        boundaries: geometry,
        center_coordinates: {
          type: 'Point',
          coordinates: centroid
        },
        major_cities: [],
        contact_info: {}
      };
    });

    // Insert new administrative boundary data
    const { data, error: insertError } = await supabaseClient
      .from('election_districts')
      .insert(processedFeatures)
      .select();

    if (insertError) {
      console.error('Error inserting administrative boundaries:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to insert data', details: insertError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Successfully imported ${data?.length || 0} administrative boundaries`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully imported ${data?.length || 0} administrative boundaries`,
        data: data 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Calculate centroid of a MultiPolygon
function calculateCentroid(geometry: any): [number, number] {
  if (geometry.type === 'MultiPolygon') {
    let totalX = 0;
    let totalY = 0;
    let totalPoints = 0;

    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const point of ring) {
          totalX += point[0];
          totalY += point[1];
          totalPoints++;
        }
      }
    }

    return [totalX / totalPoints, totalY / totalPoints];
  } else if (geometry.type === 'Polygon') {
    let totalX = 0;
    let totalY = 0;
    let totalPoints = 0;

    for (const ring of geometry.coordinates) {
      for (const point of ring) {
        totalX += point[0];
        totalY += point[1];
        totalPoints++;
      }
    }

    return [totalX / totalPoints, totalY / totalPoints];
  }

  return [0, 0];
}