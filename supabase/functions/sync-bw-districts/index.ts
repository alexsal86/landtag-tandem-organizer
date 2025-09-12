import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import proj4 from 'https://esm.sh/proj4@2.9.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Official district name mapping for validation and normalization
const OFFICIAL_DISTRICT_NAMES = {
  1: "Stuttgart I", 2: "Stuttgart II", 3: "Stuttgart III", 4: "Stuttgart IV",
  5: "Böblingen", 6: "Sindelfingen", 7: "Ludwigsburg", 8: "Waiblingen", 9: "Esslingen",
  10: "Göppingen", 11: "Reutlingen", 12: "Tübingen", 13: "Balingen", 14: "Rottweil",
  15: "Tuttlingen-Donaueschingen", 16: "Villingen-Schwenningen", 17: "Konstanz",
  18: "Ravensburg", 19: "Bodensee", 20: "Biberach", 21: "Ulm", 22: "Ehingen",
  23: "Aalen", 24: "Heidenheim", 25: "Schwäbisch Gmünd", 26: "Backnang-Schwäbisch Hall",
  27: "Heilbronn", 28: "Neckarsulm-Gundelsheim", 29: "Eppingen", 30: "Bruchsal",
  31: "Ettlingen", 32: "Karlsruhe I", 33: "Karlsruhe II", 34: "Heidelberg",
  35: "Weinheim", 36: "Mannheim I", 37: "Mannheim II", 38: "Schwetzingen",
  39: "Wiesloch", 40: "Pforzheim", 41: "Enzkreis", 42: "Calw", 43: "Freudenstadt",
  44: "Rastatt", 45: "Baden-Baden", 46: "Offenburg", 47: "Lahr",
  48: "Emmendingen-Lenzkirch", 49: "Freiburg I", 50: "Freiburg II", 51: "Breisgau",
  52: "Müllheim", 53: "Lörrach", 54: "Waldshut", 55: "Stockach", 56: "Sigmaringen",
  57: "Mengen", 58: "Aulendorf", 59: "Bad Saulgau", 60: "Wangen",
  61: "Leutkirch", 62: "Biberach", 63: "Laupheim", 64: "Neu-Ulm", 65: "Günzburg",
  66: "Krumbach", 67: "Mindelheim", 68: "Memmingen", 69: "Kempten", 70: "Lindau"
} as const;

// Define coordinate systems
const etrs89Utm32 = '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
const epsg31467 = '+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs';
const wgs84 = '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs';

// Helper function to reproject coordinates from EPSG:31467 to WGS84
function reprojectCoordinates(coordinates: any, sourceProj: string, targetProj: string): any {
  if (!Array.isArray(coordinates)) return coordinates;
  
  // Handle different coordinate structures
  if (typeof coordinates[0] === 'number') {
    // Single coordinate pair [x, y] or [x, y, z]
    const [x, y] = coordinates;
    if (typeof x === 'number' && typeof y === 'number') {
      const [lon, lat] = proj4(sourceProj, targetProj, [x, y]);
      return [lon, lat];
    }
  }
  
  // Recursively process arrays
  return coordinates.map(coord => reprojectCoordinates(coord, sourceProj, targetProj));
}

// Helper function to calculate centroid from MultiPolygon/Polygon
function calculateCentroid(geometry: any): { lat: number; lng: number } {
  try {
    let allCoords: number[][] = [];
    
    if (geometry.type === 'Polygon') {
      allCoords = geometry.coordinates[0]; // Exterior ring
    } else if (geometry.type === 'MultiPolygon') {
      // Use first polygon's exterior ring
      allCoords = geometry.coordinates[0][0];
    }
    
    if (allCoords.length === 0) return { lat: 49.0, lng: 8.4 };
    
    // Calculate centroid using shoelace formula
    let area = 0;
    let cx = 0;
    let cy = 0;
    
    for (let i = 0; i < allCoords.length - 1; i++) {
      const [x0, y0] = allCoords[i];
      const [x1, y1] = allCoords[i + 1];
      const a = x0 * y1 - x1 * y0;
      area += a;
      cx += (x0 + x1) * a;
      cy += (y0 + y1) * a;
    }
    
    area *= 0.5;
    if (Math.abs(area) < 0.000001) {
      // Fallback to arithmetic mean
      const n = allCoords.length;
      const avgLon = allCoords.reduce((sum, coord) => sum + coord[0], 0) / n;
      const avgLat = allCoords.reduce((sum, coord) => sum + coord[1], 0) / n;
      return { lat: avgLat, lng: avgLon };
    }
    
    return {
      lat: cy / (6 * area),
      lng: cx / (6 * area)
    };
  } catch (error) {
    console.warn('Error calculating centroid:', error);
    return { lat: 49.0, lng: 8.4 };
  }
}

// Helper function to calculate approximate area in km²
function calculateArea(geometry: any): number {
  try {
    let coords: number[][] = [];
    
    if (geometry.type === 'Polygon') {
      coords = geometry.coordinates[0];
    } else if (geometry.type === 'MultiPolygon') {
      coords = geometry.coordinates[0][0];
    }
    
    if (coords.length === 0) return 0;
    
    // Use shoelace formula for area calculation
    let area = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[i + 1];
      area += (x1 * y2 - x2 * y1);
    }
    area = Math.abs(area) / 2;
    
    // Convert from square degrees to square kilometers (rough approximation)
    // 1 degree ≈ 111 km at this latitude
    return (area * 111 * 111) / 1000000;
  } catch (error) {
    console.warn('Error calculating area:', error);
    return 0;
  }
}

// Normalize district name for validation
function normalizeDistrictName(name: string): string {
  return name
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã/g, 'ß')
    .replace(/Ãœ/g, 'Ü')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã–/g, 'Ö')
    .trim();
}

// Get district number from properties
function getDistrictNumber(properties: any): number | null {
  const candidates = [
    properties?.Nummer,
    properties?.nummer,
    properties?.WK_NR,
    properties?.wk_nr,
    properties?.NUMMER,
    properties?.district_number
  ];
  
  for (const candidate of candidates) {
    if (candidate) {
      const num = parseInt(String(candidate), 10);
      if (!isNaN(num) && num >= 1 && num <= 70) {
        return num;
      }
    }
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = 'https://wawofclbehbkebjivdte.supabase.co';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Starting Baden-Württemberg districts sync...');

    // Load complete LTW 2021 GeoJSON data from public folder
    console.log('Loading LTW 2021 GeoJSON data...');
    
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/public/public-data/LTWahlkreise2021-BW.geojson`);
    
    let geoJsonData: any;
    
    if (response.ok) {
      geoJsonData = await response.json();
      console.log(`Loaded GeoJSON with ${geoJsonData.features?.length || 0} features from storage`);
    } else {
      // Fallback: load from public folder via direct URL
      const fallbackResponse = await fetch('https://wawofclbehbkebjivdte.supabase.co/rest/v1/rpc/get_public_file?path=data/LTWahlkreise2021-BW.geojson');
      
      if (fallbackResponse.ok) {
        geoJsonData = await fallbackResponse.json();
        console.log(`Loaded GeoJSON with ${geoJsonData.features?.length || 0} features from public folder`);
      } else {
        throw new Error('Failed to load GeoJSON data from both storage and public folder');
      }
    }

    if (!geoJsonData?.features || !Array.isArray(geoJsonData.features)) {
      throw new Error('Invalid GeoJSON data structure');
    }

    console.log(`Processing ${geoJsonData.features.length} features...`);

    // Validate data quality
    if (geoJsonData.features.length !== 70) {
      console.warn(`Expected 70 districts, but found ${geoJsonData.features.length}`);
    }

    // Determine source projection
    const sourceProj = geoJsonData.crs?.properties?.name?.includes('31467') ? epsg31467 : etrs89Utm32;
    console.log('Using source projection:', sourceProj === epsg31467 ? 'EPSG:31467' : 'ETRS89/UTM32');

    const processedDistricts: any[] = [];
    const processedNumbers = new Set<number>();

    for (const feature of geoJsonData.features) {
      const districtNumber = getDistrictNumber(feature.properties);
      
      if (!districtNumber) {
        console.warn('Skipping feature without valid district number:', feature.properties);
        continue;
      }
      
      if (processedNumbers.has(districtNumber)) {
        console.warn(`Duplicate district number ${districtNumber}, skipping...`);
        continue;
      }
      
      processedNumbers.add(districtNumber);
      
      console.log(`Processing Wahlkreis ${districtNumber}...`);
      
      // Get and normalize district name
      let districtName = normalizeDistrictName(
        feature.properties?.['WK Name'] || 
        feature.properties?.name || 
        OFFICIAL_DISTRICT_NAMES[districtNumber as keyof typeof OFFICIAL_DISTRICT_NAMES] ||
        `Wahlkreis ${districtNumber}`
      );
      
      // Use official name if available
      const officialName = OFFICIAL_DISTRICT_NAMES[districtNumber as keyof typeof OFFICIAL_DISTRICT_NAMES];
      if (officialName) {
        districtName = officialName;
      }

      // Reproject geometry from source projection to WGS84
      let reprojectectedGeometry: any = null;
      
      try {
        if (feature.geometry) {
          reprojectectedGeometry = {
            type: feature.geometry.type,
            coordinates: reprojectCoordinates(feature.geometry.coordinates, sourceProj, wgs84)
          };
        }
      } catch (error) {
        console.error(`Failed to reproject geometry for district ${districtNumber}:`, error);
        continue;
      }

      if (!reprojectectedGeometry) {
        console.warn(`No valid geometry for district ${districtNumber}, skipping...`);
        continue;
      }

      // Calculate centroid and area from reprojected geometry
      const centroid = calculateCentroid(reprojectectedGeometry);
      const area = calculateArea(reprojectectedGeometry);

      const districtData = {
        district_number: districtNumber,
        district_name: districtName,
        district_type: 'wahlkreis',
        region: 'Baden-Württemberg',
        boundaries: reprojectectedGeometry,
        center_coordinates: centroid,
        area_km2: Math.round(area * 100) / 100, // Round to 2 decimal places
        population: null,
        major_cities: [],
        rural_percentage: null,
        contact_info: null,
        website_url: null
      };

      processedDistricts.push(districtData);
    }

    console.log(`Successfully processed ${processedDistricts.length} districts`);

    // Validate we have all 70 districts
    const missingNumbers: number[] = [];
    for (let i = 1; i <= 70; i++) {
      if (!processedNumbers.has(i)) {
        missingNumbers.push(i);
      }
    }
    
    if (missingNumbers.length > 0) {
      console.warn(`Missing district numbers: ${missingNumbers.join(', ')}`);
    }

    // Clear existing data and insert new data
    console.log('Clearing existing election districts...');
    
    const { error: deleteError } = await supabase
      .from('election_districts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
      
    if (deleteError) {
      console.error('Error clearing existing districts:', deleteError);
      throw deleteError;
    }

    console.log('Inserting processed districts in chunks...');
    
    // Insert in chunks to avoid payload size limits
    const chunkSize = 10;
    for (let i = 0; i < processedDistricts.length; i += chunkSize) {
      const chunk = processedDistricts.slice(i, i + chunkSize);
      console.log(`Inserting chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(processedDistricts.length / chunkSize)}...`);
      
      const { error: insertError } = await supabase
        .from('election_districts')
        .insert(chunk);
        
      if (insertError) {
        console.error(`Error inserting chunk ${Math.floor(i / chunkSize) + 1}:`, insertError);
        throw insertError;
      }
    }

    console.log('Baden-Württemberg districts sync completed successfully!');
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${processedDistricts.length} districts`,
        processed_count: processedDistricts.length,
        missing_districts: missingNumbers
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error syncing districts:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});