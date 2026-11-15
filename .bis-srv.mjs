import { createServer } from 'vite'; import fs from 'fs';
const s = await createServer({ configFile:'/dev-server/vite.config.ts', logLevel:'silent', server:{port:8140, strictPort:true}, optimizeDeps:{force:true} });
await s.listen();
const t=Date.now(); const iv=setInterval(async()=>{ if (fs.existsSync('/dev-server/node_modules/.vite/deps/_metadata.json')) { console.log('DONE', Date.now()-t); await s.close(); process.exit(0);} if(Date.now()-t>40000){console.log('TIMEOUT');process.exit(1);} },300);
