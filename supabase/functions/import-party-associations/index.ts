import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PartyCsvRow {
  Kreisverband: string;
  Telefon: string;
  Webseite: string;
  'E-Mail': string;
  Social: string;
  'StraÃe': string;
  Hausnummer: string;
  Ort: string;
  Vorwahl: string;
  Rufnummer: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting party associations import...');

    // Get tenant_id from auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    // Get user's primary tenant
    const { data: tenantData, error: tenantError } = await supabase
      .rpc('get_user_primary_tenant_id', { _user_id: user.id });

    if (tenantError || !tenantData) {
      throw new Error('Could not get user tenant');
    }

    const tenantId = tenantData;

    // Parse CSV data from request body
    let csvData: string;
    const body = await req.text();
    
    if (body) {
      csvData = body;
    } else {
      throw new Error('No CSV data provided');
    }

    console.log('CSV data received, parsing...');

    // Parse CSV manually (simple parsing for our specific format)
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    const rows: PartyCsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length >= headers.length) {
        const row: any = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index]?.trim() || '';
        });
        rows.push(row);
      }
    }

    console.log(`Parsed ${rows.length} rows`);

    // Function to fix encoding issues
    const fixEncoding = (str: string): string => {
      return str
        .replace(/Ã¤/g, 'ä')
        .replace(/Ã¶/g, 'ö')
        .replace(/Ã¼/g, 'ü')
        .replace(/ÃŸ/g, 'ß')
        .replace(/Ã„/g, 'Ä')
        .replace(/Ã–/g, 'Ö')
        .replace(/Ãœ/g, 'Ü')
        .replace(/Ã©/g, 'é')
        .replace(/Ã/g, 'Ü')
        .trim();
    };

    // Function to normalize phone numbers
    const normalizePhone = (phone: string, area: string): string => {
      if (!phone && !area) return '';
      
      let fullPhone = phone || area || '';
      fullPhone = fullPhone.replace(/\s+/g, '');
      
      if (fullPhone && !fullPhone.startsWith('+') && !fullPhone.startsWith('0')) {
        fullPhone = '0' + fullPhone;
      }
      
      return fullPhone;
    };

    // Load administrative boundaries for mapping
    const { data: boundaries, error: boundariesError } = await supabase
      .from('election_districts')
      .select('*')
      .eq('district_type', 'kreis');

    if (boundariesError) {
      console.error('Error loading administrative boundaries:', boundariesError);
    }

    const partyAssociations = rows.map(row => {
      const name = fixEncoding(row.Kreisverband || '');
      const street = fixEncoding(row['StraÃe'] || '');
      const city = fixEncoding(row.Ort || '');
      const website = row.Webseite || '';
      const email = row['E-Mail'] || '';
      const phone = normalizePhone(row.Telefon || '', row.Vorwahl || '');
      
      // Build full address
      const addressParts = [
        street,
        row.Hausnummer,
        city
      ].filter(part => part && part.trim()).map(part => fixEncoding(part));
      
      const fullAddress = addressParts.join(' ');

      // Try to map to administrative boundaries
      const coverageAreas: string[] = [];
      if (boundaries && boundaries.length > 0) {
        // Simple mapping based on name similarity
        const normalizedName = name.toLowerCase()
          .replace(/[\/\-\s]+/g, ' ')
          .replace(/kreis|stadt|landkreis/g, '')
          .trim();

        boundaries.forEach(boundary => {
          const boundaryName = boundary.district_name.toLowerCase();
          if (normalizedName.includes(boundaryName) || boundaryName.includes(normalizedName)) {
            coverageAreas.push(boundary.district_name);
          }
        });
      }

      return {
        tenant_id: tenantId,
        name,
        party_name: 'GRÜNE',
        party_type: 'kreisverband',
        phone: phone || null,
        website: website || null,
        email: email || null,
        address_street: street || null,
        address_number: row.Hausnummer || null,
        address_city: city || null,
        full_address: fullAddress || null,
        coverage_areas: JSON.stringify(coverageAreas),
        contact_info: JSON.stringify({
          social: row.Social || '',
          area_code: row.Vorwahl || '',
          phone_number: row.Rufnummer || ''
        })
      };
    });

    console.log(`Inserting ${partyAssociations.length} party associations...`);

    // Insert into database
    const { data: insertData, error: insertError } = await supabase
      .from('party_associations')
      .insert(partyAssociations)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log(`Successfully inserted ${insertData?.length || 0} party associations`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully imported ${insertData?.length || 0} party associations`,
        data: insertData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in import-party-associations:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Import failed', 
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});