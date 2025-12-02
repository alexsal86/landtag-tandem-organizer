import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import proj4 from 'https://esm.sh/proj4@2.10.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// EPSG:31467 (Gauss-Krüger Zone 3) to WGS84 transformation
const epsg31467 = '+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs'
const wgs84 = '+proj=longlat +datum=WGS84 +no_defs'

// Types for geometry processing
type Geometry = { 
  type: 'Polygon' | 'MultiPolygon'; 
  coordinates: any;
}

type CRSInfo = {
  isWGS84: boolean;
  sourceDef: string;
  detectionMethod: string;
}

// Helper functions for geometry processing

/**
 * Detect the source CRS of the GeoJSON
 */
function detectCRS(geoJson: any): CRSInfo {
  // Check if CRS is explicitly defined
  if (geoJson.crs?.properties?.name) {
    const crsName = geoJson.crs.properties.name.toString().toLowerCase()
    
    if (crsName.includes('epsg:4326') || crsName.includes('epsg::4326')) {
      return {
        isWGS84: true,
        sourceDef: wgs84,
        detectionMethod: 'CRS property (EPSG:4326)'
      }
    }
    
    if (crsName.includes('31467')) {
      return {
        isWGS84: false,
        sourceDef: epsg31467,
        detectionMethod: 'CRS property (EPSG:31467)'
      }
    }
  }
  
  // Fallback heuristic: check first coordinate magnitude
  if (geoJson.features?.length > 0) {
    const firstFeature = geoJson.features[0]
    if (firstFeature.geometry?.coordinates?.length > 0) {
      let firstCoord: number[] | null = null
      
      // Navigate to first coordinate based on geometry type
      if (firstFeature.geometry.type === 'Polygon') {
        firstCoord = firstFeature.geometry.coordinates[0]?.[0]
      } else if (firstFeature.geometry.type === 'MultiPolygon') {
        firstCoord = firstFeature.geometry.coordinates[0]?.[0]?.[0]
      }
      
      if (firstCoord && firstCoord.length >= 2) {
        const [x] = firstCoord
        if (Math.abs(x) > 1e5) {
          return {
            isWGS84: false,
            sourceDef: epsg31467,
            detectionMethod: 'Coordinate magnitude heuristic (projected)'
          }
        } else {
          return {
            isWGS84: true,
            sourceDef: wgs84,
            detectionMethod: 'Coordinate magnitude heuristic (geographic)'
          }
        }
      }
    }
  }
  
  // Default fallback to current behavior (assume EPSG:31467)
  return {
    isWGS84: false,
    sourceDef: epsg31467,
    detectionMethod: 'Default fallback (EPSG:31467)'
  }
}

/**
 * Remove Z coordinates recursively from geometry
 */
function stripZ(geometry: Geometry): Geometry {
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[0], coord[1]])
      )
    }
  } else if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon: number[][][]) =>
        polygon.map((ring: number[][]) =>
          ring.map((coord: number[]) => [coord[0], coord[1]])
        )
      )
    }
  }
  return geometry
}

/**
 * Ensure ring is closed and filter out invalid rings
 */
function ensureClosedAndFilter(ring: number[][]): number[][] | null {
  if (ring.length < 4) {
    return null // Ring must have at least 4 points
  }
  
  // Ensure ring is closed
  const first = ring[0]
  const last = ring[ring.length - 1]
  
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...ring, first] // Close the ring
  }
  
  return ring
}

/**
 * Normalize geometry by ensuring rings are closed and valid
 */
function normalizeGeometry(geometry: Geometry): Geometry {
  if (geometry.type === 'Polygon') {
    const validRings = geometry.coordinates
      .map((ring: number[][]) => ensureClosedAndFilter(ring))
      .filter((ring: number[][] | null) => ring !== null)
    
    return {
      type: 'Polygon',
      coordinates: validRings
    }
  } else if (geometry.type === 'MultiPolygon') {
    const validPolygons = geometry.coordinates
      .map((polygon: number[][][]) => {
        const validRings = polygon
          .map((ring: number[][]) => ensureClosedAndFilter(ring))
          .filter((ring: number[][] | null) => ring !== null)
        return validRings.length > 0 ? validRings : null
      })
      .filter((polygon: number[][][] | null) => polygon !== null)
    
    return {
      type: 'MultiPolygon',
      coordinates: validPolygons
    }
  }
  
  return geometry
}

/**
 * Snap coordinates to grid to reduce floating point noise
 */
function snapToGrid(geometry: Geometry, gridSize: number): Geometry {
  const snapCoord = (coord: number) => Math.round(coord / gridSize) * gridSize
  
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((ring: number[][]) =>
        ring.map((coord: number[]) => [snapCoord(coord[0]), snapCoord(coord[1])])
      )
    }
  } else if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon: number[][][]) =>
        polygon.map((ring: number[][]) =>
          ring.map((coord: number[]) => [snapCoord(coord[0]), snapCoord(coord[1])])
        )
      )
    }
  }
  
  return geometry
}

/**
 * Reproject geometry from source to destination CRS
 */
function reprojectGeometry(geometry: Geometry, sourceDef: string, destDef: string): Geometry {
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((ring: number[][]) =>
        ring.map((coord: number[]) => {
          const [x, y] = coord
          return proj4(sourceDef, destDef, [x, y])
        })
      )
    }
  } else if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon: number[][][]) =>
        polygon.map((ring: number[][]) =>
          ring.map((coord: number[]) => {
            const [x, y] = coord
            return proj4(sourceDef, destDef, [x, y])
          })
        )
      )
    }
  }
  
  return geometry
}

/**
 * Round lon/lat coordinates to specified decimal places
 */
function roundLonLat(geometry: Geometry, decimals: number = 6): Geometry {
  const roundCoord = (coord: number) => Math.round(coord * Math.pow(10, decimals)) / Math.pow(10, decimals)
  
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((ring: number[][]) =>
        ring.map((coord: number[]) => [roundCoord(coord[0]), roundCoord(coord[1])])
      )
    }
  } else if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon: number[][][]) =>
        polygon.map((ring: number[][]) =>
          ring.map((coord: number[]) => [roundCoord(coord[0]), roundCoord(coord[1])])
        )
      )
    }
  }
  
  return geometry
}

/**
 * Calculate polygon area using shoelace formula
 */
function calculatePolygonArea(ring: number[][]): number {
  let area = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[i + 1]
    area += x0 * y1 - x1 * y0
  }
  return Math.abs(area) / 2
}

/**
 * Calculate polygon centroid using shoelace formula
 */
function calculatePolygonCentroid(ring: number[][]): [number, number] {
  let area = 0
  let centroidX = 0
  let centroidY = 0
  
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[i + 1]
    
    const a = x0 * y1 - x1 * y0
    area += a
    centroidX += (x0 + x1) * a
    centroidY += (y0 + y1) * a
  }
  
  area *= 0.5
  centroidX /= (6 * area)
  centroidY /= (6 * area)
  
  return [centroidX, centroidY]
}

/**
 * Calculate centroid in source CRS using proper polygon area weighting
 */
function calculateCentroidInSourceCRS(geometry: Geometry): [number, number] {
  if (geometry.type === 'Polygon') {
    const [outerRing, ...holes] = geometry.coordinates
    
    // Calculate outer ring centroid and area
    const outerArea = calculatePolygonArea(outerRing)
    const outerCentroid = calculatePolygonCentroid(outerRing)
    
    // If no holes, return outer centroid
    if (holes.length === 0) {
      return outerCentroid
    }
    
    // Calculate hole contributions
    let totalArea = outerArea
    let weightedX = outerCentroid[0] * outerArea
    let weightedY = outerCentroid[1] * outerArea
    
    for (const hole of holes) {
      const holeArea = calculatePolygonArea(hole)
      const holeCentroid = calculatePolygonCentroid(hole)
      
      totalArea -= holeArea
      weightedX -= holeCentroid[0] * holeArea
      weightedY -= holeCentroid[1] * holeArea
    }
    
    return [weightedX / totalArea, weightedY / totalArea]
    
  } else if (geometry.type === 'MultiPolygon') {
    let totalArea = 0
    let weightedX = 0
    let weightedY = 0
    
    for (const polygon of geometry.coordinates) {
      const [outerRing, ...holes] = polygon
      
      // Calculate outer ring contribution
      const outerArea = calculatePolygonArea(outerRing)
      const outerCentroid = calculatePolygonCentroid(outerRing)
      
      let polygonArea = outerArea
      let polygonX = outerCentroid[0] * outerArea
      let polygonY = outerCentroid[1] * outerArea
      
      // Subtract hole contributions
      for (const hole of holes) {
        const holeArea = calculatePolygonArea(hole)
        const holeCentroid = calculatePolygonCentroid(hole)
        
        polygonArea -= holeArea
        polygonX -= holeCentroid[0] * holeArea
        polygonY -= holeCentroid[1] * holeArea
      }
      
      totalArea += polygonArea
      weightedX += polygonX
      weightedY += polygonY
    }
    
    return [weightedX / totalArea, weightedY / totalArea]
  }
  
  // Fallback for unsupported geometry types
  return [0, 0]
}

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

    console.log('Starting election districts import...')

    // Prefer GeoJSON content from request body
    let geoJsonData: string | null = null
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        if (body && body.geojson) {
          if (typeof body.geojson === 'string') {
            geoJsonData = body.geojson
          } else {
            geoJsonData = JSON.stringify(body.geojson)
          }
          console.log('Using GeoJSON provided in request body')
        }
      } catch (e) {
        console.log('No JSON body or invalid JSON, falling back to file lookup')
      }
    }

    // Fallback: attempt to read from local file paths (may not exist in deployed env)
    if (!geoJsonData) {
      console.log('Loading GeoJSON from local files as fallback...')
      try {
        const localPath = './LTWahlkreise2021-BW.geojson'
        geoJsonData = await Deno.readTextFile(localPath)
        console.log('Successfully read local GeoJSON file')
      } catch (localError) {
        console.log('Local file not found, trying alternative paths...', (localError as Error).message)
        const paths = [
          '/var/task/public/data/LTWahlkreise2021-BW.geojson',
          './public/data/LTWahlkreise2021-BW.geojson',
          '../../../public/data/LTWahlkreise2021-BW.geojson',
          'public/data/LTWahlkreise2021-BW.geojson',
        ]
        
        for (const path of paths) {
          try {
            geoJsonData = await Deno.readTextFile(path)
            console.log(`Successfully read from path: ${path}`)
            break
          } catch (error) {
            console.log(`Failed to read from ${path}:`, (error as Error).message)
          }
        }
      }
    }

    if (!geoJsonData) {
      throw new Error('No GeoJSON provided and no local file found. Please POST the GeoJSON in the request body under "geojson".')
    }

    const geoJson = JSON.parse(geoJsonData)
    console.log(`Loaded GeoJSON with ${geoJson.features.length} features`)

    // Detect source CRS
    const crsInfo = detectCRS(geoJson)
    console.log(`Detected source CRS: ${crsInfo.detectionMethod}`)
    console.log(`Source is WGS84: ${crsInfo.isWGS84}`)
    
    // Transform and insert districts
    const districts = []
    let skippedCount = 0
    
    for (const feature of geoJson.features) {
      const props = feature.properties
      const districtNumber = parseInt(props.Nummer)
      const districtName = props["WK Name"]
      
      if (!districtNumber || !districtName) {
        console.warn(`Skipping feature with missing data:`, props)
        skippedCount++
        continue
      }

      console.log(`Processing district ${districtNumber}: ${districtName}`)

      try {
        // Step 1: Strip Z coordinates
        let geometry = stripZ(feature.geometry)
        
        // Step 2: Normalize rings (ensure closure, filter invalid)
        geometry = normalizeGeometry(geometry)
        
        // Step 3: If projected CRS, snap to 0.1m grid before transformation
        if (!crsInfo.isWGS84) {
          geometry = snapToGrid(geometry, 0.1)
        }
        
        // Step 4: Calculate centroid in source CRS
        const centroidInSource = calculateCentroidInSourceCRS(geometry)
        
        // Step 5: Transform geometry to WGS84 if needed
        let finalGeometry = geometry
        let finalCentroid = centroidInSource
        
        if (!crsInfo.isWGS84) {
          console.log(`  Reprojecting from ${crsInfo.sourceDef} to WGS84`)
          finalGeometry = reprojectGeometry(geometry, crsInfo.sourceDef, wgs84)
          // Transform centroid separately
          finalCentroid = proj4(crsInfo.sourceDef, wgs84, centroidInSource)
        } else {
          console.log(`  Skipping reprojection (already WGS84)`)
        }
        
        // Step 6: Round coordinates to 6 decimals and optionally snap to fine grid
        finalGeometry = roundLonLat(finalGeometry, 6)
        
        // If already WGS84, apply fine grid snapping (1e-6 degrees ≈ 0.11m)
        if (crsInfo.isWGS84) {
          finalGeometry = snapToGrid(finalGeometry, 1e-6)
        }
        
        // Round centroid coordinates
        const roundedCentroid = [
          Math.round(finalCentroid[0] * 1e6) / 1e6,
          Math.round(finalCentroid[1] * 1e6) / 1e6
        ]
        
        districts.push({
          district_number: districtNumber,
          district_name: districtName,
          region: 'Baden-Württemberg',
          district_type: 'wahlkreis',
          boundaries: finalGeometry,
          center_coordinates: {
            lat: roundedCentroid[1],
            lng: roundedCentroid[0]
          }
        })
        
      } catch (error) {
        console.warn(`Failed to process district ${districtNumber}: ${districtName}`, error)
        skippedCount++
      }
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
    console.log(`Summary: ${districts.length} imported, ${skippedCount} skipped`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: districts.length,
        skipped: skippedCount,
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
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})