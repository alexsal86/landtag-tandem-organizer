import { build } from 'vite'; import fs from 'fs';
const deps = process.argv.slice(2);
fs.writeFileSync('/dev-server/.bis-entry.js', deps.map((d,i)=>`export * as m${i} from ${JSON.stringify(d)};`).join('\n'));
await build({ configFile:false, root:'/dev-server', logLevel:'silent', build:{ write:false, minify:false, lib:{ entry:'/dev-server/.bis-entry.js', formats:['es'] } } });
console.log('done');
