import { test } from "@playwright/test";
import assert from "node:assert/strict";

// Synthetic identity; all service calls are intercepted before any request leaves the browser.
test.use({ viewport: { width: 1400, height: 1000 }, serviceWorkers: "block" });
test("admin deep links, search, query failures and mobile navigation", async ({ page, context }, testInfo) => {
const user={id:'33333333-3333-4333-8333-333333333333',email:'admin@example.test',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{display_name:'Test Admin'}};
const tenant={id:'11111111-1111-4111-8111-111111111111',name:'Testbüro',settings:{},is_active:true,created_at:'2026-01-01T00:00:00Z'};
let failAudit=false;const requests: string[]=[];
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
try{
 await page.goto('/administration?adminSection=superadmin&adminSubSection=tenants');
 await page.getByRole('textbox',{name:'Administration durchsuchen'}).waitFor({timeout:60000});
 assert.ok(page.url().includes('adminSection=superadmin'),'Deep link survives async checks');
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
 await page.setViewportSize({width:390,height:844});
 await page.goto('/administration?adminSection=security&adminSubSection=general');
 await page.getByRole('button',{name:'System & Sicherheit · Allgemein'}).click();
 await page.getByRole('textbox',{name:'Administration durchsuchen'}).waitFor();
 await page.getByRole('textbox',{name:'Administration durchsuchen'}).fill('Kosten');
 await page.getByRole('button',{name:'Kostenmanagement',exact:true}).waitFor();
 await page.screenshot({path:testInfo.outputPath('admin-mobile.png'),fullPage:true});
 console.log(JSON.stringify({passed:true,checks:['async platform deep link','menu search and audit route','audit RPC','visible query error','mobile navigation and finance search'],pageErrors:errors}));
}catch(error){console.log((await page.locator('body').innerText()).slice(0,3000));console.log('page errors',errors);throw error;}


});
