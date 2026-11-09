import ts from 'typescript';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
function load(file, dependencies) {
  let handler;
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/^import .*;$/gm,'');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace('export {};','');
  vm.runInNewContext(js,{Deno:{serve:h=>handler=h,env:{get:()=>''}},serve:h=>handler=h,Response,Request,console,getCorsHeaders:()=>({}),withSafeHandler:(_,h)=>h,...dependencies});
  return handler;
}
let dbCalls=0;
const forbiddenDb=()=>{dbCalls++;throw Error('Unexpected database access');};
const cron=load('supabase/functions/run-workflow-cron/index.ts',{requireServiceRole:()=>false,createClient:forbiddenDb});
assert.equal((await cron(new Request('https://test/',{method:'POST'}))).status,403);
assert.equal(dbCalls,0);
const archive=load('supabase/functions/archive-letter/index.ts',{requireAuth:async()=>null,unauthorizedResponse:()=>new Response(null,{status:401}),createClient:forbiddenDb});
assert.equal((await archive(new Request('https://test/',{method:'POST'}))).status,401);
assert.equal(dbCalls,0);
const dispatcher=load('supabase/functions/workflow-dispatcher/index.ts',{requireServiceRole:()=>false,requireAuth:async()=>({userId:'actor'}),forbiddenResponse:()=>new Response(null,{status:403}),createClient:()=>({rpc:async()=>({data:false,error:null}),from:forbiddenDb})});
assert.equal((await dispatcher(new Request('https://test/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trigger_type:'manual',tenant_id:'office',workflow_id:'workflow',dry_run:true})}))).status,403);
assert.equal(dbCalls,0);
console.log('Admin edge guards passed: cron, archive and dispatcher deny unauthorized callers before business data access.');
