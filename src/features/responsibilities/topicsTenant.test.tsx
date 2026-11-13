import {act,renderHook,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {useTopics} from '@/hooks/useTopics';
const mock=vi.hoisted(()=>({tenant:{id:'a'},requests:[] as Array<{tenant:string;resolve:(value:unknown)=>void}>}));
vi.mock('@/hooks/useTenant',()=>({useTenant:()=>({currentTenant:mock.tenant})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:(table:string)=>{
 expect(table).toBe('topics');let tenant='';const chain={select:()=>chain,eq:(key:string,value:string)=>{expect(key).toBe('tenant_id');tenant=value;return chain;},order:()=>new Promise(resolve=>mock.requests.push({tenant,resolve}))};return chain;
}}}));
it('verwirft verspätete Themenantworten des zuvor ausgewählten Tenants',async()=>{
 const {result,rerender}=renderHook(()=>useTopics());
 await waitFor(()=>expect(mock.requests).toHaveLength(1));
 mock.tenant={id:'b'};rerender();
 expect(result.current.topics).toEqual([]);
 await waitFor(()=>expect(mock.requests).toHaveLength(2));
 await act(async()=>{mock.requests[1].resolve({data:[{id:'b-topic'}],error:null});});
 expect(result.current.topics.map(t=>t.id)).toEqual(['b-topic']);
 await act(async()=>{mock.requests[0].resolve({data:[{id:'a-topic'}],error:null});});
 expect(result.current.topics.map(t=>t.id)).toEqual(['b-topic']);
 expect(mock.requests.map(r=>r.tenant)).toEqual(['a','b']);
});
