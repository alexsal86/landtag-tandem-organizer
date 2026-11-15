import { resolveConfig, optimizeDeps } from 'vite';
const deps = process.argv.slice(2);
const cfg = await resolveConfig({ configFile:'/dev-server/vite.config.ts', cacheDir:'/tmp/bis/cache'+process.pid, logLevel:'silent', optimizeDeps:{ include:deps, noDiscovery:true, entries:[] } }, 'serve', 'development');
cfg.optimizeDeps.include = deps;
await optimizeDeps(cfg, true);
console.log('done');
