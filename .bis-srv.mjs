import { createServer } from 'vite'; import fs from 'fs';
const deps = fs.readFileSync('/tmp/bis/deps.txt','utf8').trim().split('\n');
const [a,b] = process.argv.slice(3).map(Number);
const s = await createServer({ configFile:'/dev-server/vite.config.ts', logLevel:'info', cacheDir: process.argv[2], server:{port:0}, optimizeDeps:{force:true, include: deps.slice(a,b)} });
await s.listen();
const t=Date.now();
const iv=setInterval(()=>{ if (fs.existsSync(process.argv[2]+'/deps/_metadata.json')) { console.log('DONE', Date.now()-t); process.exit(0);} },300);
