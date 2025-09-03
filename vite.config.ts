import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize chunks for better performance
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          
          // Radix UI components
          if (id.includes('node_modules/@radix-ui')) {
            return 'ui-vendor';
          }
          
          // Lexical editor
          if (id.includes('node_modules/lexical') || id.includes('node_modules/@lexical')) {
            return 'lexical-vendor';
          }
          
          // Document processing libraries
          if (id.includes('node_modules/docx') || id.includes('node_modules/html2canvas') || 
              id.includes('node_modules/jspdf') || id.includes('node_modules/xlsx') || 
              id.includes('node_modules/papaparse')) {
            return 'document-vendor';
          }
          
          // Supabase and query libraries
          if (id.includes('node_modules/@supabase') || id.includes('node_modules/@tanstack')) {
            return 'supabase-vendor';
          }
          
          // Collaboration libraries
          if (id.includes('node_modules/yjs') || id.includes('node_modules/y-websocket')) {
            return 'collaboration-vendor';
          }
          
          // Chart libraries
          if (id.includes('node_modules/recharts')) {
            return 'charts-vendor';
          }
        }
      }
    },
    // Increase chunk size warning limit since we're manually chunking
    chunkSizeWarningLimit: 1000
  }
}));
