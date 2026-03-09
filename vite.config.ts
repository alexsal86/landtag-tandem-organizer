import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' https://cdn.gpteng.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss: ws:; object-src 'none'; frame-ancestors https://*.lovable.app https://*.lovableproject.com https://lovable.dev; base-uri 'self'",  
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: securityHeaders,
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
    dedupe: [
      'lexical',
      '@lexical/code',
      '@lexical/file',
      '@lexical/hashtag',
      '@lexical/html',
      '@lexical/link',
      '@lexical/list',
      '@lexical/mark',
      '@lexical/markdown',
      '@lexical/plain-text',
      '@lexical/react',
      '@lexical/rich-text',
      '@lexical/table',
      '@lexical/yjs',
    ],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@radix-ui/react-compose-refs": path.resolve(__dirname, "./src/lib/radix-compose-refs-patch.ts"),
      "@radix-ui/react-slot": path.resolve(__dirname, "./src/lib/radix-slot-patch.tsx"),
      // Force all @lexical packages to top-level node_modules (prevent nested 0.41.x)
      "lexical": path.resolve(__dirname, "node_modules/lexical"),
      "@lexical/code": path.resolve(__dirname, "node_modules/@lexical/code"),
      "@lexical/file": path.resolve(__dirname, "node_modules/@lexical/file"),
      "@lexical/hashtag": path.resolve(__dirname, "node_modules/@lexical/hashtag"),
      "@lexical/html": path.resolve(__dirname, "node_modules/@lexical/html"),
      "@lexical/link": path.resolve(__dirname, "node_modules/@lexical/link"),
      "@lexical/list": path.resolve(__dirname, "node_modules/@lexical/list"),
      "@lexical/mark": path.resolve(__dirname, "node_modules/@lexical/mark"),
      "@lexical/markdown": path.resolve(__dirname, "node_modules/@lexical/markdown"),
      "@lexical/plain-text": path.resolve(__dirname, "node_modules/@lexical/plain-text"),
      "@lexical/react": path.resolve(__dirname, "node_modules/@lexical/react"),
      "@lexical/rich-text": path.resolve(__dirname, "node_modules/@lexical/rich-text"),
      "@lexical/table": path.resolve(__dirname, "node_modules/@lexical/table"),
      "@lexical/yjs": path.resolve(__dirname, "node_modules/@lexical/yjs"),
    },
  },
  optimizeDeps: {
    include: [
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react',
      'react-dom',
      '@radix-ui/react-slot',
      '@radix-ui/react-compose-refs',
    ],
    exclude: [
      '@matrix-org/matrix-sdk-crypto-wasm',
      // '@radix-ui/react-compose-refs',
      // '@radix-ui/react-slot',
      // '@radix-ui/react-primitive',
    ],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          'vendor-editor': ['lexical', '@lexical/react', '@lexical/rich-text', '@lexical/list', '@lexical/link', '@lexical/markdown', '@lexical/html', '@lexical/code', '@lexical/table', '@lexical/yjs', '@lexical/plain-text', '@lexical/hashtag', '@lexical/mark', '@lexical/file'],
          'vendor-matrix': ['matrix-js-sdk', 'yjs', 'y-websocket', 'y-indexeddb'],
          'vendor-pdf': ['pdfjs-dist', 'jspdf', 'docx'],
          'vendor-charts-maps': ['recharts', 'leaflet', 'react-leaflet', 'proj4'],
          'vendor-date': ['date-fns', 'rrule'],
          'vendor-motion': ['framer-motion'],
          'vendor-dnd': ['@hello-pangea/dnd'],
          'vendor-ui': ['class-variance-authority', 'clsx', 'tailwind-merge', 'cmdk', 'input-otp', 'embla-carousel-react', 'vaul', 'sonner'],
        },
      },
    },
  },
}));
