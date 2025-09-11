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

export interface GeoJsonData {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export const loadElectoralDistrictsGeoJson = async (): Promise<{ [key: number]: [number, number][] }> => {
  try {
    console.log('Loading GeoJSON data from ZIP file...');
    
    // Load the ZIP file from public directory
    const zipPath = '/data/LTWahlkreise2021-BW_GEOJSON.zip';
    console.log('Fetching ZIP file from:', zipPath);
    const response = await fetch(zipPath);
    if (!response.ok) {
      console.error('Failed to fetch ZIP file. Status:', response.status, response.statusText);
      throw new Error(`Failed to load ZIP file: ${response.status} ${response.statusText}`);
    }
    console.log('ZIP file loaded successfully, size:', response.headers.get('content-length'), 'bytes');
    
    const arrayBuffer = await response.arrayBuffer();
    const zip = new JSZip();
    const zipContents = await zip.loadAsync(arrayBuffer);
    
    // Find the GeoJSON file in the ZIP
    let geoJsonContent: string | null = null;
    for (const [filename, file] of Object.entries(zipContents.files)) {
      if (filename.toLowerCase().endsWith('.geojson') || filename.toLowerCase().endsWith('.json')) {
        console.log('Found GeoJSON file:', filename);
        geoJsonContent = await file.async('string');
        break;
      }
    }
    
    if (!geoJsonContent) {
      throw new Error('No GeoJSON file found in ZIP');
    }
    
    // Parse the GeoJSON
    const geoJsonData: GeoJsonData = JSON.parse(geoJsonContent);
    console.log('Parsed GeoJSON with', geoJsonData.features.length, 'features');
    
    // Convert to district boundaries format
    const boundaries: { [key: number]: [number, number][] } = {};
    
    geoJsonData.features.forEach((feature) => {
      const districtNumber = feature.properties.WKR_NR;
      console.log('Processing feature:', {
        districtNumber,
        districtName: feature.properties.WKR_NAME,
        geometryType: feature.geometry.type
      });
      
      if (!districtNumber) {
        console.warn('Feature missing WKR_NR:', feature.properties);
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

const extractCoordinates = (geometry: GeoJsonFeature['geometry']): [number, number][] => {
  if (geometry.type === 'Polygon') {
    // For Polygon, take the outer ring (first array)
    const outerRing = geometry.coordinates[0];
    return outerRing.map(coord => [coord[1], coord[0]] as [number, number]); // Convert [lng, lat] to [lat, lng]
  } else if (geometry.type === 'MultiPolygon') {
    // For MultiPolygon, take the largest polygon (first one usually)
    const firstPolygon = geometry.coordinates[0];
    if (firstPolygon && firstPolygon[0]) {
      const outerRing = firstPolygon[0];
      return outerRing.map(coord => [coord[1], coord[0]] as [number, number]); // Convert [lng, lat] to [lat, lng]
    }
  }
  
  return [];
};