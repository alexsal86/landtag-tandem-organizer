import L from 'leaflet';

// Legacy plugins read the global L instead of importing Leaflet themselves.
// Publish the same mutable instance that the map components use.
(globalThis as typeof globalThis & { L: typeof L }).L = L;

export default L;
