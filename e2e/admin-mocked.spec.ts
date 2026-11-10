import { test } from "@playwright/test";
import assert from "node:assert/strict";

// Synthetic identity; all service calls are intercepted before any request leaves the browser.
test.use({ viewport: { width: 1400, height: 1000 }, serviceWorkers: "block" });
test("admin deep links, search, query failures and mobile navigation", async ({ page, context }, testInfo) => {
const user={id:'33333333-3333-4333-8333-333333333333',email:'admin@example.test',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{display_name:'Test Admin'}};
const tenant={id:'11111111-1111-4111-8111-111111111111',name:'Testbüro',settings:{},is_active:true,created_at:'2026-01-01T00:00:00Z'};
let failAudit=false;const requests: string[]=[];
const routineExamples = [
 { month:1,day:31,name:'Jahresrückblick erstellen',done:true,system:false },
 { month:1,day:1,name:'Urlaubstage zurücksetzen',done:true,system:true },
 { month:1,day:15,name:'Krankentage archivieren',done:true,system:true },
 { month:3,day:31,name:'Resturlaub verfällt',done:false,system:true },
 { month:7,day:1,name:'Halbjahresbilanz',done:false,system:false },
 { month:11,day:1,name:'Urlaubsplanung nächstes Jahr',done:false,system:false },
 { month:12,day:15,name:'Jahresende-Statistiken',done:false,system:false },
];
const routineRules = routineExamples.map((item,i)=>({id:`routine-${i}`,name:item.name,description:null,module:'tasks',trigger_type:'manual',trigger_config:{schedule_kind:'annual',month:String(item.month),day:String(item.day),hour:'9',timezone:'Europe/Berlin'},actions:[{type:'run_annual_routine',payload:{system_function:item.system?'execute_reset_vacation_days':'',annual_task_id:`annual-${i}`}}],conditions:{all:[]},enabled:true,updated_at:'2026-01-01T00:00:00Z'}));

await context.route('https://wawofclbehbkebjivdte.supabase.co/**',async route=>{
 const req=route.request(), url=new URL(req.url()), path=url.pathname; requests.push(path);
 const single=req.headers()['accept']?.includes('object+json');let data: unknown=single?null:[];
 if(path.endsWith('/auth/v1/user'))data=user;
 else if(path.includes('/rpc/')){
   const name=path.split('/').pop();
   if(['is_superadmin','is_admin','has_role'].includes(name))data=true;
   else if(name==='search_admin_audit_logs'){
     if(failAudit)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Test query failure'})});
     data={logs:[],totalCount:0};
   }else if(name==='get_admin_tenant_health')data={};
 }
 else if(path.endsWith('/automation_rules'))data=routineRules;
 else if(path.endsWith('/annual_tasks'))data=routineExamples.map((item,i)=>({id:`annual-${i}`,due_month:item.month,due_day:item.day,automation_rule_id:`routine-${i}`}));
 else if(path.endsWith('/annual_task_completions'))data=routineExamples.flatMap((item,i)=>item.done?[{annual_task_id:`annual-${i}`,completed_at:'2026-02-01T12:00:00Z',linked_task_id:null}]:[]);
 else if(path.endsWith('/user_tenant_memberships')){
   const m={id:'membership',user_id:user.id,tenant_id:tenant.id,role:'abgeordneter',is_active:true,tenant};data=single?m:[m];
 }else if(path.endsWith('/tenants'))data=single?tenant:[tenant];
 else if(path.endsWith('/user_onboarding_state'))data={completed_at:'2026-01-01T00:00:00Z'};
 else if(path.endsWith('/profiles')){const p={id:'profile',user_id:user.id,display_name:'Test Admin',tenant_id:tenant.id,avatar_url:null};data=single?p:[p];}
 else if(path.includes('/functions/v1/'))data={success:true,users:[]};
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
});
await context.route('https://**/*',async route=>{if(route.request().url().includes('wawofclbehbkebjivdte.supabase.co'))return route.fallback();return route.abort();});
await context.addInitScript(({user})=>{
 const payload=btoa(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iss:'https://wawofclbehbkebjivdte.supabase.co/auth/v1'}));
 localStorage.setItem('sb-wawofclbehbkebjivdte-auth-token',JSON.stringify({access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.synthetic`,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}));
}, {user});
const errors: string[]=[];page.on('pageerror',err=>errors.push(err.message));
const assertAdminFillsContent = async () => {
 const layout = await page.getByTestId('administration-layout').boundingBox();
 const main = await page.locator('#main-content').boundingBox();
 assert.ok(layout && main);
 assert.ok(Math.abs(layout.y-main.y) <= 1, 'Admin starts at the content top');
 assert.ok(Math.abs(layout.y+layout.height-main.y-main.height) <= 1, 'Admin fills the available height without a bottom strip');
 assert.ok(layout.x+layout.width <= page.viewportSize()!.width+1, 'Admin fits the viewport width');
};
try{
 await page.goto('/administration?adminSection=superadmin&adminSubSection=tenants');
 await page.getByRole('textbox',{name:'Administration durchsuchen'}).waitFor({timeout:60000});
 assert.ok(page.url().includes('adminSection=superadmin'),'Deep link survives async checks');
 await assertAdminFillsContent();
 const search=page.getByRole('textbox',{name:'Administration durchsuchen'});
 await search.fill('Audit');
 await page.getByRole('button',{name:'Audit-Logs',exact:true}).click();
 await page.getByText('Aktuelle Seite als CSV').waitFor();
 assert.ok(requests.some(path=>path.endsWith('/search_admin_audit_logs')));
 await page.screenshot({path:testInfo.outputPath('admin-desktop.png'),fullPage:true});
 failAudit=true;
 await page.reload();
 await page.getByText('Audit-Logs konnten nicht geladen werden.',{exact:false}).waitFor({timeout:15000});
 assert.equal(await page.getByText('Keine Logs gefunden',{exact:true}).count(),0);
 failAudit=false;
 await page.goto('/administration?adminSection=security&adminSubSection=permissions');
 await page.getByRole('tab', { name: 'Felder', exact: true }).click();
 await page.getByRole('combobox').first().waitFor();
 assert.ok(await page.getByRole('option', { name: 'Nur Feld ausblenden', exact: true }).count());
 assert.ok(await page.getByRole('option', { name: 'Datensatz sperren', exact: true }).count());
 await page.setViewportSize({width:390,height:844});
 await page.goto('/administration?adminSection=security&adminSubSection=general');
 await assertAdminFillsContent();
 await page.getByRole('button',{name:'System & Sicherheit · Allgemein'}).click();
 await page.getByRole('textbox',{name:'Administration durchsuchen'}).waitFor();
 await page.getByRole('textbox',{name:'Administration durchsuchen'}).fill('Kosten');
 await page.getByRole('button',{name:'Kostenmanagement',exact:true}).waitFor();
 await page.screenshot({path:testInfo.outputPath('admin-mobile.png'),fullPage:true});

 await page.setViewportSize({width:1400,height:1000});
 await page.goto('/administration?adminSection=automation&adminSubSection=rules&automationTab=annual');
 const annual=page.getByRole('region',{name:/^Jahresroutinen \d+$/});
 await annual.getByRole('heading',{name:/Jahresroutinen/}).waitFor();
 assert.equal(await annual.getByRole('article').count(),7);
 await page.screenshot({path:testInfo.outputPath('annual-routines-desktop.png'),fullPage:true});
 await page.evaluate(()=>document.documentElement.classList.add('dark'));
 await page.screenshot({path:testInfo.outputPath('annual-routines-dark.png'),fullPage:true});
 await page.evaluate(()=>document.documentElement.classList.remove('dark'));
 await annual.getByRole('group',{name:'Routinen filtern'}).getByRole('button',{name:'Erledigt'}).click();
 assert.equal(await annual.getByRole('article').count(),3);
 await annual.getByRole('group',{name:'Routinen filtern'}).getByRole('button',{name:'Offen'}).click();
 assert.equal(await annual.getByRole('article').count(),4);
 await annual.getByRole('group',{name:'Routinen filtern'}).getByRole('button',{name:'Alle',exact:true}).click();
 await annual.getByRole('checkbox',{name:'Monate ohne Routine anzeigen'}).uncheck();
 assert.equal(await annual.getByRole('region',{name:/Februar \d+/}).count(),0);
 await page.setViewportSize({width:390,height:844});
 assert.ok(await annual.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Annual timeline fits the mobile width');
 await page.screenshot({path:testInfo.outputPath('annual-routines-mobile.png'),fullPage:true});
 await annual.getByRole('article',{name:'Resturlaub verfällt'}).scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('annual-routines-mobile-cards.png'),fullPage:true});
 assert.equal(errors.length,0,'No browser JavaScript errors');
 console.log(JSON.stringify({passed:true,checks:['async platform deep link','menu search and audit route','audit RPC','visible query error','mobile navigation and finance search','annual timeline, filters and month visibility','annual light/dark and mobile layout'],pageErrors:errors}));
}catch(error){console.log((await page.locator('body').innerText()).slice(0,3000));console.log('page errors',errors);throw error;}


});
