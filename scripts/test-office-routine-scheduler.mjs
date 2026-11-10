import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const js=path=>ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/^import .*;$/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/export (?=function|const|class)/g,'').replace('export {};','');
const year=new Intl.DateTimeFormat('en',{timeZone:'Europe/Berlin',year:'numeric'}).format(new Date());
const rules=['pending','confirmed'].map(id=>({id,name:id,tenant_id:'office',module:'tasks',trigger_config:{},actions:[{type:'run_annual_routine',payload:{routine_requires_confirmation:'true',routine_confirmed_year:id==='confirmed'?year:''}}]}));
const sent=[];let handler;
const client={from:table=>{
 const query={select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,maybeSingle:async()=>({data:table==='tenants'?{automations_paused:false}:null,error:null}),then:resolve=>resolve({data:table==='automation_rules'?rules:[],error:null})};return query;
}};
const context={Deno:{serve:h=>handler=h,env:{get:()=> 'test'}},Response,Request,console,createClient:()=>client,requireServiceRole:()=>true,sharedCorsHeaders:{},forbiddenResponse:()=>new Response(null,{status:403}),withSafeHandler:(_,h)=>h,isCalendarSchedule:()=>false,calendarOccurrence:()=>null,scheduleRunKey:()=>'',fetch:async(_,init)=>{sent.push(JSON.parse(init.body));return new Response(JSON.stringify({status:'success'}),{status:200,headers:{'Content-Type':'application/json'}});}};
vm.createContext(context);vm.runInContext(js('supabase/functions/_shared/officeRoutinePlan.ts'),context);vm.runInContext(js('supabase/functions/run-scheduled-automation-rules/index.ts'),context);
const response=await handler(new Request('https://example.test',{method:'POST',body:'{}'}));assert.equal(response.status,200);assert.equal(sent.length,1);assert.equal(sent[0].ruleId,'confirmed');
console.log('Actual scheduler passed: only the annually confirmed office package is dispatched.');
