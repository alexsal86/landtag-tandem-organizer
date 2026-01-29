import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Berechne deutsche Feiertage (bundesweit + Baden-Württemberg)
function calculateGermanHolidays(year: number) {
  // Ostersonntag berechnen (Gauß-Algorithmus)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  return [
    // Bundesweite Feiertage
    { holiday_date: `${year}-01-01`, name: 'Neujahr', is_nationwide: true, state: null },
    { holiday_date: formatDate(addDays(easter, -2)), name: 'Karfreitag', is_nationwide: true, state: null },
    { holiday_date: formatDate(easter), name: 'Ostersonntag', is_nationwide: true, state: null },
    { holiday_date: formatDate(addDays(easter, 1)), name: 'Ostermontag', is_nationwide: true, state: null },
    { holiday_date: `${year}-05-01`, name: 'Tag der Arbeit', is_nationwide: true, state: null },
    { holiday_date: formatDate(addDays(easter, 39)), name: 'Christi Himmelfahrt', is_nationwide: true, state: null },
    { holiday_date: formatDate(addDays(easter, 49)), name: 'Pfingstsonntag', is_nationwide: true, state: null },
    { holiday_date: formatDate(addDays(easter, 50)), name: 'Pfingstmontag', is_nationwide: true, state: null },
    { holiday_date: `${year}-10-03`, name: 'Tag der Deutschen Einheit', is_nationwide: true, state: null },
    { holiday_date: `${year}-12-25`, name: 'Erster Weihnachtstag', is_nationwide: true, state: null },
    { holiday_date: `${year}-12-26`, name: 'Zweiter Weihnachtstag', is_nationwide: true, state: null },
    // Baden-Württemberg spezifisch
    { holiday_date: `${year}-01-06`, name: 'Heilige Drei Könige', is_nationwide: false, state: 'BW' },
    { holiday_date: formatDate(addDays(easter, 60)), name: 'Fronleichnam', is_nationwide: false, state: 'BW' },
    { holiday_date: `${year}-11-01`, name: 'Allerheiligen', is_nationwide: false, state: 'BW' },
  ];
}

serve(async (req) => {
  console.log('sync-holidays function called');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const year = body.year || new Date().getFullYear();
    
    console.log(`Syncing holidays for year ${year}`);
    
    const holidays = calculateGermanHolidays(year);
    console.log(`Calculated ${holidays.length} holidays`);

    // Upsert holidays - use ON CONFLICT to update existing or insert new
    const { data, error } = await supabase
      .from('public_holidays')
      .upsert(holidays, { 
        onConflict: 'holiday_date,name',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('Upsert error:', error);
      throw error;
    }

    console.log(`Successfully synced ${holidays.length} holidays for ${year}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        year, 
        count: holidays.length,
        holidays: holidays.map(h => ({ date: h.holiday_date, name: h.name }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in sync-holidays:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
