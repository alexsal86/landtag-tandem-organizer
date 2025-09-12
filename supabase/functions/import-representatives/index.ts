import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Representative {
  name: string;
  party: string;
  mandate_type: 'direct' | 'list';
  district_id: string;
  order_index: number;
}

interface District {
  id: string;
  district_number: number;
  district_name: string;
}

// Small helpers for parsing
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}
function decodeHtmlEntities(text: string): string {
  const map: Record<string, string> = {
    '&amp;': '&',
    '&nbsp;': ' ',
    '&#160;': ' ',
    '&quot;': '"',
    '&apos;': "'",
    '&ouml;': 'ö', '&auml;': 'ä', '&uuml;': 'ü',
    '&Ouml;': 'Ö', '&Auml;': 'Ä', '&Uuml;': 'Ü',
    '&szlig;': 'ß'
  };
  return text.replace(/&[a-zA-Z#0-9]+;/g, (m) => map[m] ?? m);
}
function cleanText(text: string): string {
  return decodeHtmlEntities(stripTags(text)).replace(/\s+/g, ' ').trim();
}
function normalizeParty(party: string): string {
  const p = cleanText(party).toUpperCase();
  if (p.includes('BÜNDNIS 90') || p.includes('GRÜN')) return 'GRÜNE';
  if (p.includes('AFD')) return 'AfD';
  if (p.includes('CDU')) return 'CDU';
  if (p.includes('SPD')) return 'SPD';
  if (p.includes('FDP')) return 'FDP/DVP';
  return cleanText(party);
}
function mandateToType(m: string): 'direct' | 'list' {
  const t = cleanText(m).toUpperCase();
  if (t === 'E' || t.includes('ERST') || t.includes('DIREKT')) return 'direct';
  // Some tables use Z or Zweitmandat/Liste
  return 'list';
}
function extractDistrictNumber(wk: string): string | null {
  const txt = cleanText(wk);
  const m = txt.match(/^(\d{1,3})/);
  if (m) return m[1];
  const m2 = txt.match(/WK\s*(\d{1,3})/i);
  if (m2) return m2[1];
  return null;
}

// Extract the HTML of the first wikitable after the headline id="Abgeordnete"
function extractAbgeordneteTable(html: string): string | null {
  const anchorIdx = html.indexOf('id="Abgeordnete"');
  const startSearch = anchorIdx >= 0 ? anchorIdx : 0;
  const tableStart = html.indexOf('<table', startSearch);
  if (tableStart === -1) return null;
  // find matching closing tag
  let depth = 0;
  for (let i = tableStart; i < html.length; i++) {
    if (html.startsWith('<table', i)) depth++;
    if (html.startsWith('</table>', i)) {
      depth--;
      if (depth === 0) {
        return html.slice(tableStart, i + '</table>'.length);
      }
    }
  }
  return null;
}

// Parse a simple wikipedia table into rows of string cells
function parseWikiTable(tableHtml: string): { headers: string[]; rows: string[][] } {
  // split rows
  const rowHtmls = tableHtml.split(/<\s*tr[^>]*>/i).slice(1); // drop before first <tr>
  let headers: string[] = [];
  const rows: string[][] = [];

  for (const r of rowHtmls) {
    // header row has <th>
    const thMatches = Array.from(r.matchAll(/<\s*th[^>]*>([\s\S]*?)<\s*\/th>/gi)).map(m => cleanText(m[1]));
    if (thMatches.length) {
      headers = thMatches.map(h => h.replace(/:$/, ''));
      continue;
    }
    const tdMatches = Array.from(r.matchAll(/<\s*td[^>]*>([\s\S]*?)<\s*\/td>/gi)).map(m => cleanText(m[1]));
    if (tdMatches.length) rows.push(tdMatches);
  }
  return { headers, rows };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting representatives import...');

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch current districts to map numbers to IDs
    console.log('Fetching election districts...');
    const { data: districts, error: districtsError } = await supabase
      .from('election_districts')
      .select('id, district_number, district_name')
      .order('district_number');

    if (districtsError) {
      console.error('Error fetching districts:', districtsError);
      throw districtsError;
    }
    console.log(`Found ${districts.length} districts`);

    const districtByNumber = new Map<string, District>();
    for (const d of districts) districtByNumber.set(String(d.district_number), d);

    // Fetch Wikipedia HTML via MediaWiki API
    const wikiApi = 'https://de.wikipedia.org/w/api.php?action=parse&page=Liste_der_Mitglieder_des_Landtags_von_Baden-W%C3%BCrttemberg_(17._Wahlperiode)&prop=text&formatversion=2&format=json';
    console.log('Fetching Wikipedia table...');
    const wikiRes = await fetch(wikiApi, { headers: { 'User-Agent': 'Supabase-Edge-Importer/1.0 (+github.com/supabase)' } });
    if (!wikiRes.ok) throw new Error(`Failed to fetch Wikipedia API: ${wikiRes.status} ${wikiRes.statusText}`);
    const wikiJson = await wikiRes.json();
    const html: string = wikiJson?.parse?.text ?? '';
    if (!html) throw new Error('Wikipedia HTML not found in API response');

    const tableHtml = extractAbgeordneteTable(html);
    if (!tableHtml) throw new Error('Could not locate "Abgeordnete" table on Wikipedia page');

    const { headers, rows } = parseWikiTable(tableHtml);
    console.log('Parsed headers:', headers);

    // Determine indices by header names (robust to minor changes)
    const headerIndex = (candidates: string[]): number => {
      const idx = headers.findIndex(h => candidates.some(c => h.toLowerCase().includes(c)));
      return idx;
    };
    const nameIdx = headerIndex(['name']);
    const partyIdx = headerIndex(['partei', 'fraktion']);
    const wkIdx = headerIndex(['wahlkreis']);
    const mandIdx = headerIndex(['mandat']);

    if (nameIdx === -1 || partyIdx === -1 || wkIdx === -1 || mandIdx === -1) {
      throw new Error(`Expected columns not found. Got headers: ${JSON.stringify(headers)}`);
    }

    type ParsedRep = { name: string; party: string; districtNumber: string | null; mandate: 'E' | 'Z' };
    const parsed: ParsedRep[] = [];

    for (const cells of rows) {
      // Skip rows that don't have enough columns
      if (cells.length < Math.max(nameIdx, partyIdx, wkIdx, mandIdx) + 1) continue;
      const name = cleanText(cells[nameIdx]);
      const party = normalizeParty(cells[partyIdx]);
      const districtNumber = extractDistrictNumber(cells[wkIdx]);
      const mandCell = cleanText(cells[mandIdx]);
      const mandate: 'E' | 'Z' = /(^|\b)E(\b|$)|ERST|DIREKT/i.test(mandCell) ? 'E' : 'Z';
      if (!name) continue;
      parsed.push({ name, party, districtNumber, mandate });
    }

    console.log(`Parsed ${parsed.length} rows from Wikipedia.`);

    // Validate expected count; Wikipedia table should have 154 entries for 17. WP
    if (parsed.length !== 154) {
      throw new Error(`Wikipedia parse mismatch: expected 154 rows, got ${parsed.length}. Headers: ${JSON.stringify(headers)}.`);
    }

    // Build insert payload
    const representatives: Representative[] = [];
    const skipped: Array<{ name: string; reason: string; wk?: string | null }> = [];

    parsed.forEach((rep, idx) => {
      const wkNo = rep.districtNumber;
      const district = wkNo ? districtByNumber.get(String(wkNo)) : undefined;
      if (!district) {
        skipped.push({ name: rep.name, reason: 'District not found', wk: wkNo });
        return;
      }
      representatives.push({
        name: rep.name,
        party: rep.party,
        mandate_type: rep.mandate === 'E' ? 'direct' : 'list',
        district_id: district.id,
        order_index: idx,
      });
    });

    console.log(`Prepared ${representatives.length} representatives for insert. Skipped ${skipped.length}.`);
    if (representatives.length < 150) {
      throw new Error(`Too many representatives were skipped (${skipped.length}). Aborting to avoid partial import.`);
    }

    // Clear existing representatives only after successful parsing
    console.log('Clearing existing representatives...');
    const { error: delErr } = await supabase
      .from('election_representatives')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) throw delErr;

    console.log(`Inserting ${representatives.length} representatives...`);
    const batchSize = 100;
    for (let i = 0; i < representatives.length; i += batchSize) {
      const batch = representatives.slice(i, i + batchSize);
      const { error: insertError } = await supabase.from('election_representatives').insert(batch);
      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
        throw insertError;
      }
      console.log(`Inserted batch ${i / batchSize + 1}/${Math.ceil(representatives.length / batchSize)}`);
    }

    // Simple stats
    const byMandate = representatives.reduce((acc, r) => {
      acc[r.mandate_type] = (acc[r.mandate_type] ?? 0) + 1; return acc;
    }, {} as Record<string, number>);
    const byParty = representatives.reduce((acc, r) => {
      acc[r.party] = (acc[r.party] ?? 0) + 1; return acc;
    }, {} as Record<string, number>);

    console.log('Successfully imported election representatives!');

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully imported ${representatives.length} representatives`,
      stats: { byMandate, byParty, skipped }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error importing representatives:', error);
    return new Response(JSON.stringify({
      success: false,
      error: String(error?.message ?? error)
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});