import { resolveConfig, optimizeDeps } from 'vite';
const cfg = await resolveConfig({ configFile:'/dev-server/vite.config.ts', cacheDir:'/tmp/bis/c2'+process.pid }, 'serve', 'development');
await optimizeDeps(cfg, true);
console.log('done');
