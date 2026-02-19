import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
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
      '@radix-ui/react-select',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-compose-refs',
      '@radix-ui/react-slot',
      '@radix-ui/react-primitive',
    ],
  },
  build: {
    target: 'esnext',
  },
}));
