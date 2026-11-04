// Native Chromium IndexedDB + service-worker checks. Supply a Playwright module
// path if Playwright is installed outside this repository.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const source = await readFile(new URL('../src/features/quick-notes/storage.ts', import.meta.url),'utf8');
const storageJs = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const worker = await readFile(new URL('../public/sw.js', import.meta.url),'utf8');
const shell = '<!doctype html><title>Notes offline shell</title><script src="/assets/notes.js"></script>';
const server = createServer((request,response) => {
  response.setHeader('Cache-Control','no-store');
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/sw.js') { response.setHeader('Content-Type','application/javascript'); response.end(worker); }
  else if (path === '/quick-notes-shell.js') { response.setHeader('Content-Type','application/javascript'); response.end('self.QUICK_NOTES_SHELL = {version:"test",assets:["/index.html","/assets/notes.js","/assets/storage.js"]};'); }
  else if (path === '/assets/storage.js') { response.setHeader('Content-Type','application/javascript'); response.end(storageJs); }
  else if (path === '/assets/notes.js') { response.setHeader('Content-Type','application/javascript'); response.end('window.shellReady = true;'); }
  else if (path === '/api/private') { response.setHeader('Content-Type','application/json'); response.end('{"private":"never-cache"}'); }
  else { response.setHeader('Content-Type','text/html'); response.end(shell); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({ executablePath: process.env.QUICK_NOTES_CHROMIUM, headless:true, args:['--no-sandbox'] });
try {
  const context=await browser.newContext();
  const page=await context.newPage();
  const origin=`http://127.0.0.1:${server.address().port}`;
  await page.goto(origin);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
    const {noteStorage:store}=await import('/assets/storage.js');
    await store.writeSnapshot('alice:tenant-a',[{id:'note',content:'Local cached note'}]);
    const parent={id:'z-parent',scope:'alice:tenant-a',noteId:'new-note',kind:'create',title:'Offline',content:'First',createdAt:'2026-11-04T12:00:00Z',status:'pending'};
    await store.putWrite(parent);
    await store.putWrite({...parent,id:'a-successor',kind:'edit',content:'Latest',dependsOn:'z-parent'});
    const ordered=await store.writes('alice:tenant-a');
    if (ordered.map(w=>w.id).join(',')!=='z-parent,a-successor') throw new Error('Dependency ordering was lost');
    await store.completeWrite(parent,7);
  });
  await page.reload();
  const restored=await page.evaluate(async () => {
    const {noteStorage:store}=await import('/assets/storage.js');
    return {notes:await store.readSnapshot('alice:tenant-a'),writes:await store.writes('alice:tenant-a'),other:await store.writes('bob:tenant-a')};
  });
  assert.equal(restored.notes[0].content,'Local cached note');
  assert.equal(restored.writes.length,1);
  assert.equal(restored.writes[0].content,'Latest');
  assert.equal(restored.writes[0].baseRevision,7);
  assert.equal(restored.writes[0].dependsOn,undefined);
  assert.deepEqual(restored.other,[]);
  console.log('PASS native IndexedDB survives reload with atomic acknowledgement and isolated scopes');
  await page.evaluate(async()=>{await fetch('/api/private');});
  const cached=await page.evaluate(async()=>{
    const results=[];
    for(const key of await caches.keys()) for(const request of await (await caches.open(key)).keys()) results.push(request.url);
    return results;
  });
  assert.equal(cached.some(url=>url.includes('/api/')),false);
  console.log('PASS service worker never caches API responses');
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(()=>window.shellReady === true);
  assert.equal(await page.title(),'Notes offline shell');
  const offline=await page.evaluate(async()=>{
    const {noteStorage:store}=await import('/assets/storage.js');
    return (await store.writes('alice:tenant-a'))[0].content;
  });
  assert.equal(offline,'Latest');
  console.log('PASS offline reload serves the cached shell and retains pending text');
  await context.close();
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
