import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { contactIds, tenantId, limit = 50 } = await req.json();

    // Build query to find contacts that need geocoding
    let query = supabaseClient
      .from('contacts')
      .select('id, business_street, business_city, business_postal_code, business_house_number, business_country')
      .is('coordinates', null)
      .eq('contact_type', 'organization')
      .limit(limit);

    if (contactIds && contactIds.length > 0) {
      query = query.in('id', contactIds);
    }

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    // Only geocode contacts with at least a city
    query = query.not('business_city', 'is', null);

    const { data: contacts, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }

    console.log(`Found ${contacts.length} contacts to geocode`);

    const results = {
      total: contacts.length,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Geocode each contact with rate limiting (1 request/second for Nominatim)
    for (const contact of contacts) {
      try {
        console.log(`Geocoding contact ${contact.id}: ${contact.business_city}`);

        // Call the geocode-contact-address function
        const { data, error: geocodeError } = await supabaseClient.functions.invoke(
          'geocode-contact-address',
          {
            body: { contactId: contact.id },
          }
        );

        if (geocodeError) {
          results.failed++;
          results.errors.push(`${contact.id}: ${geocodeError.message}`);
          console.error(`Failed to geocode ${contact.id}:`, geocodeError);
        } else {
          results.success++;
          console.log(`Successfully geocoded ${contact.id}`);
        }

        // Rate limiting: wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.failed++;
        results.errors.push(`${contact.id}: ${error.message}`);
        console.error(`Error geocoding ${contact.id}:`, error);
      }
    }

    console.log('Batch geocoding completed:', results);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in batch-geocode-contacts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
