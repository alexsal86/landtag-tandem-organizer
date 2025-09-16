import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodingResult {
  lat: number;
  lng: number;
  display_name?: string;
}

interface DetectionResult {
  coordinates: { lat: number; lng: number };
  district?: {
    id: string;
    district_name: string;
    district_number: number;
  };
  partyAssociation?: {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    website?: string;
    email?: string;
  };
}

// Function to check if a point is inside a polygon using ray casting algorithm
function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  const [x, y] = point;
  
  for (const ring of polygon) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

// Function to check if point is inside MultiPolygon
function pointInMultiPolygon(point: [number, number], multiPolygon: number[][][][]): boolean {
  for (const polygon of multiPolygon) {
    if (pointInPolygon(point, polygon)) {
      return true;
    }
  }
  return false;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, coordinates } = await req.json();
    
    console.log('Detecting district for:', { location, coordinates });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let coords: GeocodingResult;

    // If coordinates are provided, use them; otherwise geocode the location
    if (coordinates?.lat && coordinates?.lng) {
      coords = coordinates;
      console.log('Using provided coordinates:', coords);
    } else if (location) {
      console.log('Geocoding location:', location);
      
      // Use Nominatim for geocoding
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1&countrycodes=de`;
      
      const geocodeResponse = await fetch(geocodeUrl, {
        headers: {
          'User-Agent': 'Supabase-District-Detection/1.0'
        }
      });
      
      if (!geocodeResponse.ok) {
        throw new Error('Geocoding failed');
      }
      
      const geocodeData = await geocodeResponse.json();
      
      if (!geocodeData || geocodeData.length === 0) {
        console.log('No geocoding results found for:', location);
        return new Response(JSON.stringify({
          error: 'Location not found',
          coordinates: null,
          district: null,
          partyAssociation: null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        });
      }
      
      const result = geocodeData[0];
      coords = {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        display_name: result.display_name
      };
      
      console.log('Geocoded coordinates:', coords);
    } else {
      throw new Error('Either location or coordinates must be provided');
    }

    // Fetch all election districts with their boundaries
    const { data: districts, error: districtsError } = await supabase
      .from('election_districts')
      .select('id, district_name, district_number, boundaries');

    if (districtsError) {
      console.error('Error fetching districts:', districtsError);
      throw new Error('Failed to fetch election districts');
    }

    console.log(`Checking ${districts?.length || 0} districts for point [${coords.lng}, ${coords.lat}]`);

    // Find the district containing this point
    let matchedDistrict = null;
    
    for (const district of districts || []) {
      if (!district.boundaries) continue;
      
      try {
        const geometry = district.boundaries;
        const point: [number, number] = [coords.lng, coords.lat]; // Note: [lng, lat] for GeoJSON
        
        if (geometry.type === 'Polygon') {
          if (pointInPolygon(point, geometry.coordinates)) {
            matchedDistrict = district;
            break;
          }
        } else if (geometry.type === 'MultiPolygon') {
          if (pointInMultiPolygon(point, geometry.coordinates)) {
            matchedDistrict = district;
            break;
          }
        }
      } catch (error) {
        console.error(`Error checking district ${district.district_name}:`, error);
        continue;
      }
    }

    console.log('Matched district:', matchedDistrict?.district_name || 'none');

    // If we found a district, look for the corresponding party association
    let matchedPartyAssociation = null;
    
    if (matchedDistrict) {
      const { data: partyAssociations, error: partyError } = await supabase
        .from('party_associations')
        .select(`
          id, name, contact_person, phone, website, email,
          administrative_boundaries
        `)
        .contains('administrative_boundaries', [matchedDistrict.id]);

      if (partyError) {
        console.error('Error fetching party associations:', partyError);
      } else if (partyAssociations && partyAssociations.length > 0) {
        matchedPartyAssociation = partyAssociations[0];
        console.log('Found party association:', matchedPartyAssociation.name);
      }
    }

    const result: DetectionResult = {
      coordinates: { lat: coords.lat, lng: coords.lng },
      district: matchedDistrict ? {
        id: matchedDistrict.id,
        district_name: matchedDistrict.district_name,
        district_number: matchedDistrict.district_number
      } : undefined,
      partyAssociation: matchedPartyAssociation ? {
        id: matchedPartyAssociation.id,
        name: matchedPartyAssociation.name,
        contact_person: matchedPartyAssociation.contact_person,
        phone: matchedPartyAssociation.phone,
        website: matchedPartyAssociation.website,
        email: matchedPartyAssociation.email
      } : undefined
    };

    console.log('Detection result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in detect-appointment-district function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      coordinates: null,
      district: null,
      partyAssociation: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});