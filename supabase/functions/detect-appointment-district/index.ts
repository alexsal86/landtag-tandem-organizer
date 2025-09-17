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
    party?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
  };
  representatives?: {
    direct_green?: {
      id: string;
      name: string;
      party: string;
      mandate_type: string;
      email?: string;
      phone?: string;
      office_address?: string;
      bio?: string;
    };
    support_green?: {
      id: string;
      name: string;
      party: string;
      mandate_type: string;
      email?: string;
      phone?: string;
      office_address?: string;
      bio?: string;
    };
    support_district?: {
      id: string;
      district_name: string;
      district_number: number;
    };
    all_representatives?: Array<{
      id: string;
      name: string;
      party: string;
      mandate_type: string;
      email?: string;
      phone?: string;
      office_address?: string;
      bio?: string;
    }>;
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

    // If we found a district, look for representatives and party association
    let matchedPartyAssociation = null;
    let representatives = null;
    
    if (matchedDistrict) {
      // Fetch party associations for this district
      console.log('Fetching party associations for district:', matchedDistrict.id);
      
      // First try with the corrected JSONB query
      let { data: partyAssociations, error: partyError } = await supabase
        .from('party_associations')
        .select(`
          id, name, party_name, phone, website, email, 
          address_street, address_number, address_city, full_address,
          contact_info, administrative_boundaries
        `)
        .contains('administrative_boundaries', `["${matchedDistrict.id}"]`);
      
      // Fallback: if the first query fails, try alternative approach
      if (partyError) {
        console.log('First query failed, trying alternative JSONB query:', partyError);
        const fallbackQuery = await supabase
          .from('party_associations')
          .select(`
            id, name, party_name, phone, website, email, 
            address_street, address_number, address_city, full_address,
            contact_info, administrative_boundaries
          `)
          .filter('administrative_boundaries', 'cs', `["${matchedDistrict.id}"]`);
        
        partyAssociations = fallbackQuery.data;
        partyError = fallbackQuery.error;
      }

      if (partyError) {
        console.error('Error fetching party associations:', partyError);
      } else {
        console.log('Found party associations:', partyAssociations?.length || 0);
        // Find the Green party association
        const greenParty = partyAssociations?.find(pa => 
          pa.party_name?.toLowerCase().includes('grün') || pa.name?.toLowerCase().includes('grün')
        );
        if (greenParty) {
          matchedPartyAssociation = greenParty;
          console.log('Found Green party association:', matchedPartyAssociation.name);
        } else if (partyAssociations && partyAssociations.length > 0) {
          matchedPartyAssociation = partyAssociations[0];
          console.log('Found party association (fallback):', matchedPartyAssociation.name);
        }
      }

      // Fetch all representatives for this district  
      console.log('Fetching representatives for district:', matchedDistrict.id);
      const { data: allRepresentatives, error: repError } = await supabase
        .from('election_representatives')
        .select('id, name, party, mandate_type, email, phone, office_address, bio')
        .eq('district_id', matchedDistrict.id);

      if (repError) {
        console.error('Error fetching representatives:', repError);
      } else if (allRepresentatives && allRepresentatives.length > 0) {
        console.log(`Found ${allRepresentatives.length} representatives for district`);
        
        // Find direct Green representative
        const directGreen = allRepresentatives.find(rep => 
          rep.party && rep.party.toLowerCase().includes('grün')
        );

        // If no direct Green rep, check for support assignment
        let supportGreen = null;
        let supportDistrict = null;
        if (!directGreen) {
          console.log('No Green representative found, checking support assignments...');
          const { data: supportAssignments, error: supportError } = await supabase
            .from('district_support_assignments')
            .select(`
              supporting_district_id,
              election_districts!supporting_district_id (
                id, district_name, district_number
              )
            `)
            .eq('assigned_district_id', matchedDistrict.id)
            .eq('is_active', true)
            .order('priority', { ascending: true })
            .limit(1);

          if (!supportError && supportAssignments && supportAssignments.length > 0) {
            const supportAssignment = supportAssignments[0];
            supportDistrict = supportAssignment.election_districts;
            console.log('Found support district:', supportDistrict.district_name);
            
            // Fetch Green representative from support district
            const { data: supportReps, error: supportRepError } = await supabase
              .from('election_representatives')
              .select('id, name, party, mandate_type, email, phone, office_address, bio')
              .eq('district_id', supportAssignment.supporting_district_id)
              .ilike('party', '%grün%')
              .limit(1);
              
            if (!supportRepError && supportReps && supportReps.length > 0) {
              supportGreen = supportReps[0];
              console.log('Found Green representative from support district:', supportGreen.name);
            }
          }
        }

        representatives = {
          direct_green: directGreen || undefined,
          support_green: supportGreen || undefined,
          support_district: supportDistrict || undefined,
          all_representatives: allRepresentatives
        };
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
        party: matchedPartyAssociation.party_name,
        contact_person: matchedPartyAssociation.contact_info?.contact_person,
        phone: matchedPartyAssociation.phone,
        email: matchedPartyAssociation.email,
        address: matchedPartyAssociation.full_address || `${matchedPartyAssociation.address_street || ''} ${matchedPartyAssociation.address_number || ''} ${matchedPartyAssociation.address_city || ''}`.trim(),
        website: matchedPartyAssociation.website
      } : undefined,
      representatives
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