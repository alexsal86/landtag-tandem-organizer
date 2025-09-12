import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import proj4 from 'https://esm.sh/proj4@2.10.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// EPSG:31467 (Gauss-Krüger Zone 3) to WGS84 transformation
const epsg31467 = '+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs'
const wgs84 = '+proj=longlat +datum=WGS84 +no_defs'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Loading GeoJSON file...')
    
    // Read the GeoJSON file from public directory
    let geoJsonData
    try {
      // Try to read from local file in the Edge Function environment
      const localPath = '/var/task/public/data/LTWahlkreise2021-BW.geojson'
      geoJsonData = await Deno.readTextFile(localPath)
      console.log('Successfully read local GeoJSON file')
    } catch (localError) {
      console.log('Local file not found, trying alternative paths...', localError.message)
      
      // Alternative paths to try
      const paths = [
        './public/data/LTWahlkreise2021-BW.geojson',
        '../../../public/data/LTWahlkreise2021-BW.geojson',
        'public/data/LTWahlkreise2021-BW.geojson',
      ]
      
      let fileRead = false
      for (const path of paths) {
        try {
          geoJsonData = await Deno.readTextFile(path)
          console.log(`Successfully read from path: ${path}`)
          fileRead = true
          break
        } catch (error) {
          console.log(`Failed to read from ${path}:`, error.message)
        }
      }
      
      if (!fileRead) {
        throw new Error('Could not find GeoJSON file in any expected location. Please ensure LTWahlkreise2021-BW.geojson is available.')
      }
    }

    const geoJson = JSON.parse(geoJsonData)
    console.log(`Loaded GeoJSON with ${geoJson.features.length} features`)

    // Transform and insert districts
    const districts = []
    
    for (const feature of geoJson.features) {
      const props = feature.properties
      const districtNumber = parseInt(props.Nummer)
      const districtName = props["WK Name"]
      
      if (!districtNumber || !districtName) {
        console.warn(`Skipping feature with missing data:`, props)
        continue
      }

      console.log(`Processing district ${districtNumber}: ${districtName}`)

      // Transform geometry from EPSG:31467 to WGS84
      const transformedGeometry = transformGeometry(feature.geometry)
      
      // Calculate centroid
      const centroid = calculateCentroid(transformedGeometry)
      
      districts.push({
        district_number: districtNumber,
        district_name: districtName,
        region: 'Baden-Württemberg',
        district_type: 'wahlkreis',
        boundaries: transformedGeometry,
        center_coordinates: {
          lat: centroid[1],
          lng: centroid[0]
        }
      })
    }

    // Clear existing data and insert new data
    console.log('Clearing existing districts...')
    const { error: deleteError } = await supabaseClient
      .from('election_districts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (deleteError) {
      console.error('Error clearing districts:', deleteError)
    }

    console.log(`Inserting ${districts.length} districts...`)
    const { error: insertError } = await supabaseClient
      .from('election_districts')
      .insert(districts)

    if (insertError) {
      console.error('Error inserting districts:', insertError)
      throw insertError
    }

    console.log('Successfully imported election districts!')

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: districts.length,
        districts: districts.map(d => ({ 
          number: d.district_number, 
          name: d.district_name 
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Import failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function transformGeometry(geometry: any): any {
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon: number[][][]) =>
        polygon.map((ring: number[][]) =>
          ring.map((coord: number[]) => {
            // Transform from EPSG:31467 to WGS84
            const [x, y] = coord
            const [lon, lat] = proj4(epsg31467, wgs84, [x, y])
            return [lon, lat]
          })
        )
      )
    }
  } else if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((ring: number[][]) =>
        ring.map((coord: number[]) => {
          const [x, y] = coord
          const [lon, lat] = proj4(epsg31467, wgs84, [x, y])
          return [lon, lat]
        })
      )
    }
  }
  
  return geometry
}

function calculateCentroid(geometry: any): [number, number] {
  let totalArea = 0
  let centroidLon = 0
  let centroidLat = 0
  
  const coordinates = geometry.type === 'MultiPolygon' 
    ? geometry.coordinates[0][0] // First polygon, first ring
    : geometry.coordinates[0] // First ring
    
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [x0, y0] = coordinates[i]
    const [x1, y1] = coordinates[i + 1]
    
    const a = x0 * y1 - x1 * y0
    totalArea += a
    centroidLon += (x0 + x1) * a
    centroidLat += (y0 + y1) * a
  }
  
  totalArea *= 0.5
  centroidLon /= (6 * totalArea)
  centroidLat /= (6 * totalArea)
  
  return [centroidLon, centroidLat]
}