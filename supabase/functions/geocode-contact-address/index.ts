import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  contactId?: string;
  address?: {
    street?: string;
    houseNumber?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { contactId, address }: GeocodeRequest = await req.json();

    let addressToGeocode = address;

    // If contactId provided, fetch address from database
    if (contactId) {
      const { data: contact, error } = await supabaseClient
        .from('contacts')
        .select('business_street, business_house_number, business_postal_code, business_city, business_country')
        .eq('id', contactId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch contact: ${error.message}`);
      }

      addressToGeocode = {
        street: contact.business_street,
        houseNumber: contact.business_house_number,
        postalCode: contact.business_postal_code,
        city: contact.business_city,
        country: contact.business_country,
      };
    }

    // Build full address string for geocoding
    const addressParts = [
      addressToGeocode?.street,
      addressToGeocode?.houseNumber,
      addressToGeocode?.postalCode,
      addressToGeocode?.city,
      addressToGeocode?.country || 'Germany',
    ].filter(Boolean);

    if (addressParts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No address provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fullAddress = addressParts.join(', ');
    console.log('Geocoding address:', fullAddress);

    // Call Nominatim Geocoding API
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
    nominatimUrl.searchParams.set('q', fullAddress);
    nominatimUrl.searchParams.set('format', 'json');
    nominatimUrl.searchParams.set('limit', '1');

    const geocodeResponse = await fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'Stadtteile-Karlsruhe-App/1.0',
      },
    });

    if (!geocodeResponse.ok) {
      throw new Error(`Nominatim API error: ${geocodeResponse.statusText}`);
    }

    const geocodeData: NominatimResponse[] = await geocodeResponse.json();

    if (geocodeData.length === 0) {
      console.log('No geocoding results found for:', fullAddress);
      
      // Save failed geocoding attempt
      if (contactId) {
        await supabaseClient
          .from('contacts')
          .update({
            geocoding_source: 'failed',
            geocoded_at: new Date().toISOString(),
          })
          .eq('id', contactId);
      }

      return new Response(
        JSON.stringify({ error: 'Address not found', address: fullAddress }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = geocodeData[0];
    const coordinates = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };

    console.log('Geocoding successful:', coordinates);

    // Save coordinates to database if contactId provided
    if (contactId) {
      const { error: updateError } = await supabaseClient
        .from('contacts')
        .update({
          coordinates: coordinates,
          geocoded_at: new Date().toISOString(),
          geocoding_source: 'nominatim',
        })
        .eq('id', contactId);

      if (updateError) {
        throw new Error(`Failed to update contact: ${updateError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        coordinates,
        address: result.display_name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in geocode-contact-address:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
