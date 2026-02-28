import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss: ws:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      ...securityHeaders,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    headers: securityHeaders,
  },
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process'],
      globals: { Buffer: true, process: true },
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@radix-ui/react-compose-refs": path.resolve(__dirname, "./src/lib/radix-compose-refs-patch.ts"),
      "@radix-ui/react-slot": path.resolve(__dirname, "./src/lib/radix-slot-patch.tsx"),
    },
  },
  optimizeDeps: {
    include: [
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react',
      'react-dom',
    ],
    exclude: [
      '@matrix-org/matrix-sdk-crypto-wasm',
      '@radix-ui/react-compose-refs',
      '@radix-ui/react-slot',
      '@radix-ui/react-primitive',
    ],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          'vendor-editor': ['lexical'],
          'vendor-matrix': ['matrix-js-sdk', 'yjs', 'y-websocket', 'y-indexeddb'],
          'vendor-pdf': ['pdfjs-dist', 'jspdf', 'docx'],
          'vendor-charts-maps': ['recharts', 'leaflet', 'react-leaflet', 'proj4'],
        },
      },
    },
  },
}));
