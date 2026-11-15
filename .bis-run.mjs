import { build } from 'vite';
const deps = process.argv.slice(2);
await build({ configFile:false, root:'/dev-server', logLevel:'silent', build:{ write:false, lib:{ entry: Object.fromEntries(deps.map((d,i)=>['e'+i, d])), formats:['es'] }, rollupOptions:{ external: [] } } });
console.log('done');
