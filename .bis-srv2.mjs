import { createServer } from 'vite';
const s = await createServer({ configFile:'/dev-server/vite.config.ts', cacheDir:'/tmp/bis/f'+process.pid, server:{port:8099}, optimizeDeps:{force:true} });
await s.listen(); console.log('listening');
