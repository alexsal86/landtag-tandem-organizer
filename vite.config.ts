import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
// import { componentTagger } from "lovable-tagger";
// import { nodePolyfills } from 'vite-plugin-node-polyfills';

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' https://cdn.gpteng.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss: ws:; object-src 'none'; frame-ancestors https://*.lovable.app https://*.lovableproject.com https://lovable.dev; base-uri 'self'",  
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
};

// Plugin to force nested @lexical/* transitive deps to resolve to top-level 0.40.0 versions.
// Prevents 0.41.x copies (which depend on @lexical/extension + toggleTextFormatType) from being used.
function lexicalDedupePlugin(): Plugin {
  const topLevelNodeModules = path.resolve(__dirname, 'node_modules');

  return {
    name: 'lexical-dedupe',
    enforce: 'pre',
    resolveId(source, importer) {
      // Only intercept when a nested @lexical package tries to import lexical or @lexical/*
      if (!importer || !source) return null;

      const isLexicalImport = source === 'lexical' || source.startsWith('@lexical/');
      if (!isLexicalImport) return null;

      // Check if the importer is inside a nested node_modules (e.g. node_modules/@lexical/markdown/node_modules/...)
      const importerRelative = path.relative(topLevelNodeModules, importer);
      const nestedNmIndex = importerRelative.indexOf('node_modules');
      if (nestedNmIndex === -1) return null;

      // Redirect to top-level resolution
      return this.resolve(source, path.resolve(topLevelNodeModules, '_virtual_root.js'), { skipSelf: true });
    },
  };
}


function publicInvitationApiProxy(): Plugin {
  const apiPrefix = '/api/public-event-invitations/';

  const resolveSupabaseFunctionUrl = (pathName: string) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      return null;
    }

    const trimmedCode = decodeURIComponent(pathName.slice(apiPrefix.length)).replace(/\/respond$/, '');
    const isRespondRequest = pathName.endsWith('/respond');
    const functionName = isRespondRequest
      ? 'respond-public-event-invitation'
      : 'get-public-event-invitation';

    return {
      targetUrl: `${supabaseUrl}/functions/v1/${functionName}`,
      publishableKey,
      publicCode: trimmedCode,
      isRespondRequest,
    };
  };

  const proxyRequest = async (req: any, res: any) => {
    if (!req.url?.startsWith(apiPrefix)) {
      return false;
    }

    const requestUrl = new URL(req.url, 'http://localhost');
    const target = resolveSupabaseFunctionUrl(requestUrl.pathname);

    if (!target || !target.publicCode) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Public invitation proxy is not configured.' }));
      return true;
    }

    const requestBody = await new Promise<string>((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });

    const upstreamBody = target.isRespondRequest
      ? JSON.stringify({ public_code: target.publicCode, ...(requestBody ? JSON.parse(requestBody) : {}) })
      : JSON.stringify({ public_code: target.publicCode });

    const upstreamResponse = await fetch(target.targetUrl, {
      method: target.isRespondRequest ? 'POST' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: target.publishableKey,
        Authorization: `Bearer ${target.publishableKey}`,
      },
      body: upstreamBody,
    });

    res.statusCode = upstreamResponse.status;
    upstreamResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    });
    res.end(await upstreamResponse.text());
    return true;
  };

  return {
    name: 'public-invitation-api-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void proxyRequest(req, res)
          .then((handled) => {
            if (!handled) next();
          })
          .catch((error) => {
            server.ssrFixStacktrace(error);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to proxy invitation request.' }));
          });
      });
    },
  };
}

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
    lexicalDedupePlugin(),
    publicInvitationApiProxy(),
    react(),
    tailwindcss(),
    // nodePolyfills({
    //   include: ['buffer', 'process'],
    //   globals: { Buffer: true, process: true },
    // }),
    // mode === 'development' &&
    // componentTagger(),
  ].filter(Boolean),
  resolve: {
    dedupe: [
      'lexical',
      '@lexical/clipboard',
      '@lexical/code',
      '@lexical/dragon',
      '@lexical/hashtag',
      '@lexical/html',
      '@lexical/link',
      '@lexical/list',
      '@lexical/mark',
      '@lexical/markdown',
      '@lexical/plain-text',
      '@lexical/react',
      '@lexical/rich-text',
      '@lexical/selection',
      '@lexical/table',
      '@lexical/utils',
      '@lexical/yjs',
    ],
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
    ],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — never changes between deploys, maximizes long-term cache hits
          'vendor-react-core': ['react', 'react-dom'],
          // Router & data-fetching split from core so a React Query upgrade doesn't bust the core cache
          'vendor-react-router': ['react-router-dom'],
          'vendor-react-query': ['@tanstack/react-query'],
          'vendor-editor': ['lexical', '@lexical/rich-text', '@lexical/list', '@lexical/link', '@lexical/markdown', '@lexical/html', '@lexical/code', '@lexical/table', '@lexical/yjs'],
          'vendor-matrix': ['matrix-js-sdk', 'yjs', 'y-websocket', 'y-indexeddb'],
          'vendor-pdf': ['pdfjs-dist', 'jspdf', 'docx'],
          'vendor-charts-maps': ['recharts', 'leaflet', 'react-leaflet', 'proj4'],
          'vendor-date': ['date-fns', 'rrule'],
          'vendor-motion': ['framer-motion'],
          'vendor-dnd': ['@hello-pangea/dnd'],
          // cmdk (command palette) is only needed when the search dialog is open — kept separate
          // so it doesn't inflate the always-loaded vendor-ui bundle
          'vendor-search': ['cmdk'],
          'vendor-ui': ['class-variance-authority', 'clsx', 'tailwind-merge', 'input-otp', 'embla-carousel-react', 'vaul', 'sonner'],
        },
      },
    },
  },
}));
