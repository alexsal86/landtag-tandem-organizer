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
    rollupOptions: {
      output: {
        manualChunks: {
          // React core libraries
          'react-vendor': ['react', 'react-dom'],
          
          // Supabase libraries
          'supabase-vendor': ['@supabase/supabase-js'],
          
          // UI component libraries
          'radix-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip'
          ],
          
          // Icon and UI utilities
          'ui-vendor': [
            'lucide-react',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'cmdk',
            'vaul',
            'sonner',
            'next-themes',
            'input-otp'
          ],
          
          // Editor libraries
          'editor-vendor': [
            'lexical',
            '@lexical/react',
            'katex'
          ],
          
          // Document processing libraries
          'document-vendor': [
            'jspdf',
            'docx',
            'xlsx',
            'html2canvas',
            'papaparse',
            'vcf'
          ],
          
          // Data management libraries
          'data-vendor': [
            '@tanstack/react-query',
            'react-hook-form',
            '@hookform/resolvers',
            'zod',
            'web-push'
          ],
          
          // Date and utility libraries
          'utils-vendor': [
            'date-fns',
            'react-day-picker'
          ],
          
          // Layout and interaction libraries
          'layout-vendor': [
            'react-router-dom',
            'react-grid-layout',
            'react-resizable-panels',
            '@hello-pangea/dnd',
            'embla-carousel-react'
          ],
          
          // Canvas and visualization libraries
          'canvas-vendor': [
            'fabric',
            'recharts'
          ]
        }
      }
    }
  }
}));
