import JSZip from 'jszip';

export interface GeoJsonFeature {
  type: 'Feature';
  properties: {
    WKR_NR?: number;
    WKR_NAME?: string;
    [key: string]: any;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

type Coordinate = [number, number];
type LinearRing = Coordinate[];
type Polygon = LinearRing[];
type MultiPolygon = Polygon[];

export interface GeoJsonData {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

// Try multiple property keys to find the district number
const getDistrictNumberFromProps = (props: Record<string, any>): number | undefined => {
  const candidates = [
    'WKR_NR', 'WKRNR', 'WK_NR', 'NR', 'WKR', 'WKR_NR_2021', 'WKR_NR21', 'WKRNR21', 'Wahlkreis_Nr'
  ];
  for (const key of candidates) {
    if (props[key] !== undefined && props[key] !== null) {
      const n = typeof props[key] === 'string' ? parseInt(props[key], 10) : Number(props[key]);
      if (!Number.isNaN(n)) return n;
    }
  }
  // Also scan any numeric-looking property
  for (const [k, v] of Object.entries(props)) {
    if (/wkr.?nr/i.test(k) || /wahlkreis.?nr/i.test(k)) {
      const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
};
export const loadElectoralDistrictsGeoJson = async (): Promise<{ [key: number]: [number, number][] }> => {
  try {
    console.log('Loading GeoJSON data from sample file...');
    
    // Load the sample GeoJSON data directly
    const geoJsonPath = '/data/sample-wahlkreise.geojson';
    console.log('Fetching GeoJSON file from:', geoJsonPath);
    const response = await fetch(geoJsonPath);
    if (!response.ok) {
      console.error('Failed to fetch GeoJSON file. Status:', response.status, response.statusText);
      throw new Error(`Failed to load GeoJSON file: ${response.status} ${response.statusText}`);
    }
    console.log('GeoJSON file loaded successfully');
    
    const geoJsonContent = await response.text();
    
    // Parse the GeoJSON
    const geoJsonData: GeoJsonData = JSON.parse(geoJsonContent);
    console.log('Parsed GeoJSON with', geoJsonData.features.length, 'features');
    
    // Convert to district boundaries format
    const boundaries: { [key: number]: [number, number][] } = {};
    
    geoJsonData.features.forEach((feature) => {
      const districtNumber = getDistrictNumberFromProps(feature.properties);
      console.log('Processing feature:', {
        districtNumber,
        availableKeys: Object.keys(feature.properties),
        districtName: feature.properties.WKR_NAME || feature.properties.Wahlkreis_Name || feature.properties.NAME || feature.properties.name,
        geometryType: feature.geometry.type
      });
      
      if (!districtNumber) {
        console.warn('Feature missing district number property. Properties:', feature.properties);
        return;
      }
      
      // Convert GeoJSON coordinates to Leaflet format [lat, lng]
      const coordinates = extractCoordinates(feature.geometry);
      if (coordinates.length > 0) {
        boundaries[districtNumber] = coordinates;
        console.log(`District ${districtNumber}: ${coordinates.length} boundary points`);
      } else {
        console.warn(`No coordinates extracted for district ${districtNumber}`);
      }
    });
    
    console.log('Converted boundaries for', Object.keys(boundaries).length, 'districts');
    return boundaries;
    
  } catch (error) {
    console.error('Error loading GeoJSON data:', error);
    throw error;
  }
};

// Simplified polygon function for better performance
const simplifyPolygon = (coordinates: [number, number][], tolerance = 0.001): [number, number][] => {
  if (coordinates.length <= 3) return coordinates;
  
  // Douglas-Peucker algorithm simplified version
  const simplified: [number, number][] = [coordinates[0]];
  
  for (let i = 1; i < coordinates.length - 1; i += 2) { // Skip every other point for basic simplification
    simplified.push(coordinates[i]);
  }
  
  simplified.push(coordinates[coordinates.length - 1]);
  return simplified;
};

const extractCoordinates = (geometry: GeoJsonFeature['geometry']): [number, number][] => {
  console.log('Extracting coordinates for geometry type:', geometry.type);
  
  if (geometry.type === 'Polygon') {
    // For Polygon, take the outer ring (first array)
    const outerRing = geometry.coordinates[0] as number[][];
    console.log('Polygon outer ring has', outerRing.length, 'points');
    
    // Convert [lng, lat] to [lat, lng] and validate coordinates
    const leafletCoords = outerRing
      .filter(coord => Array.isArray(coord) && coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number')
      .map(coord => [coord[1], coord[0]] as [number, number]);
    
    console.log('Converted to', leafletCoords.length, 'valid coordinates');
    
    // Simplify polygon for better performance
    const simplified = simplifyPolygon(leafletCoords);
    console.log('Simplified to', simplified.length, 'points');
    
    return simplified;
    
  } else if (geometry.type === 'MultiPolygon') {
    console.log('MultiPolygon with', geometry.coordinates.length, 'polygons');
    
    // Find the largest polygon by coordinate count
    const multiPolygonCoords = geometry.coordinates as number[][][][];
    let largestPolygon = multiPolygonCoords[0];
    let maxPoints = 0;
    
    multiPolygonCoords.forEach((polygon, index) => {
      if (polygon[0] && polygon[0].length > maxPoints) {
        maxPoints = polygon[0].length;
        largestPolygon = polygon;
        console.log(`Polygon ${index} has ${polygon[0].length} points (new largest)`);
      }
    });
    
    if (largestPolygon && largestPolygon[0]) {
      const outerRing = largestPolygon[0] as number[][];
      console.log('Using largest polygon outer ring with', outerRing.length, 'points');
      
      // Convert [lng, lat] to [lat, lng] and validate coordinates
      const leafletCoords = outerRing
        .filter(coord => Array.isArray(coord) && coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number')
        .map(coord => [coord[1], coord[0]] as [number, number]);
      
      console.log('Converted to', leafletCoords.length, 'valid coordinates');
      
      // Simplify polygon for better performance
      const simplified = simplifyPolygon(leafletCoords);
      console.log('Simplified to', simplified.length, 'points');
      
      return simplified;
    }
  }
  
  console.warn('Could not extract coordinates from geometry type:', geometry.type);
  return [];
};