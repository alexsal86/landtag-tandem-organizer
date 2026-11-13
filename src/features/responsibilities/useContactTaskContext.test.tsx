import {createElement,type ReactNode} from 'react';
import {renderHook,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {beforeEach,expect,it,vi} from 'vitest';
import {useContactTaskContext} from './useContactTaskContext';
const mock=vi.hoisted(()=>({from:vi.fn(),tenant:{id:'office'} as {id:string}|null,contact:{id:'contact',name:'Kontakt'} as {id:string;name:string}|null,calls:[] as Array<{table:string;filters:Array<[string,unknown]>}>}));
vi.mock('@/hooks/useTenant',()=>({useTenant:()=>({currentTenant:mock.tenant})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:mock.from}}));
const wrapper=()=>{const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return ({children}:{children:ReactNode})=>createElement(QueryClientProvider,{client},children);};
beforeEach(()=>{mock.tenant={id:'office'};mock.contact={id:'contact',name:'Kontakt'};mock.calls.length=0;mock.from.mockClear();mock.from.mockImplementation((table:string)=>{
 const call={table,filters:[] as Array<[string,unknown]>};mock.calls.push(call);
 const result={data:table==='contacts'?mock.contact:table==='contact_topics'?[{topic_id:'topic'}]:[{id:'topic'}],error:null};
 const chain={select:()=>chain,eq:(key:string,value:unknown)=>{call.filters.push([key,value]);return chain;},in:(key:string,value:unknown)=>{call.filters.push([key,value]);return chain;},maybeSingle:()=>Promise.resolve(result),then:(resolve:(value:typeof result)=>unknown)=>Promise.resolve(result).then(resolve)};return chain;
});});
it('validiert Kontakt und Themen im Tenant vor dem Vorschlag',async()=>{
 const {result}=renderHook(()=>useContactTaskContext('contact'),{wrapper:wrapper()});
 await waitFor(()=>expect(result.current.isSuccess).toBe(true));
 expect(result.current.data?.topicIds).toEqual(['topic']);
 expect(mock.calls.find(c=>c.table==='contacts')?.filters).toContainEqual(['tenant_id','office']);
 expect(mock.calls.find(c=>c.table==='topics')?.filters).toContainEqual(['tenant_id','office']);
});
it('fragt für einen fremden oder unsichtbaren Kontakt keine Themenverknüpfungen ab',async()=>{
 mock.contact=null;
 const {result}=renderHook(()=>useContactTaskContext('foreign'),{wrapper:wrapper()});
 await waitFor(()=>expect(result.current.isError).toBe(true));
 expect(mock.calls.map(c=>c.table)).toEqual(['contacts']);
});
it('fragt ohne Tenant keinen Kontakt ab',()=>{
 mock.tenant=null;
 const {result}=renderHook(()=>useContactTaskContext('contact'),{wrapper:wrapper()});
 expect(result.current.fetchStatus).toBe('idle');expect(mock.from).not.toHaveBeenCalled();
});
