// Execute the actual edge handler with local service/auth/feed doubles. No live requests.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
let source=await readFile(new URL('../supabase/functions/ics-validation/index.ts',import.meta.url),'utf8');
source=source.replace(/^import .*$/gm,'').replace(/if \(import.meta.main\) \{[\s\S]*$/,'');
const {code}=await transform(source,{loader:'ts',format:'cjs'});
let role=null, platform=false, fail=false, feeds=0, auth=true;
const createClient=()=>({
 from: table=>{
   const builder={select:()=>builder,eq:()=>builder,
     single:async()=>({data:{id:'calendar',tenant_id:'office-b',ics_url:'https://test.invalid/feed'},error:null}),
     maybeSingle:async()=>({data:role?{role}:null,error:fail?{message:'offline'}:null})};
   if(table==='external_events') {
     builder.gte=()=>builder; builder.lte=async()=>({data:[],error:null});
   }
   return builder;
 },
 rpc:async()=>({data:platform,error:null}),
});
const module={exports:{}};
const load=new Function('module','exports','createClient','requireAuth','unauthorizedResponse','getCorsHeaders','Deno','fetch','parseICSForValidation','buildExternalFeedErrorMessage',code+'; return module.exports.handler;');
const handler=load(module,module.exports,createClient,async()=>auth?{userId:'caller'}:null,()=>new Response('',{status:401}),()=>({}),{env:{get:()=>''}},async()=>{feeds++;return new Response('BEGIN:VCALENDAR\nEND:VCALENDAR')},()=>[],()=> 'Feed error');
const request=()=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify({calendar_id:'calendar'}),headers:{'Content-Type':'application/json'}});
auth=false; assert.equal((await handler(request())).status,401); auth=true;
for(const value of [null,'mitarbeiter','praktikant']) {role=value;assert.equal((await handler(request())).status,403);}
assert.equal(feeds,0,'No feed read before office authorization');
for(const value of ['abgeordneter','bueroleitung']) {role=value;assert.equal((await handler(request())).status,200);}
role=null;platform=true;assert.equal((await handler(request())).status,200);
fail=true;assert.equal((await handler(request())).status,403,'A role lookup failure must deny even a cached platform result');
assert.equal(feeds,3);
console.log('ICS handler access passed: signed-out, foreign office, staff, office admins, platform admin and lookup-error denial before feed access.');
