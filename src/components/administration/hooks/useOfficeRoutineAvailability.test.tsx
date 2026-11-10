import { act,cleanup,renderHook } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import type { ReactNode } from 'react';
import { useAutomationAdminMutations } from './useAutomationAdminData';
import type { AutomationRuleMutationPayload } from '../automationShared';
const mock=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),insert:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:mock.rpc,from:mock.from}}));
beforeEach(()=>{mock.rpc.mockReset();mock.from.mockReset();mock.insert.mockReset();mock.from.mockReturnValue({insert:mock.insert});mock.insert.mockResolvedValue({error:null});});
afterEach(cleanup);
const payload:AutomationRuleMutationPayload={tenant_id:'office',name:'Karten',description:null,module:'tasks',trigger_type:'schedule',trigger_config:{},conditions:{all:[]},actions:[{type:'run_annual_routine',payload:{routine_deadline_month:'12',routine_deadline_day:'10',routine_steps_text:'0 | Versand'}}],enabled:true};
function setup(){const client=new QueryClient({defaultOptions:{mutations:{retry:false}}});return renderHook(()=>useAutomationAdminMutations('office','actor'),{wrapper:({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});}
it('does not save an office package against a backend that cannot create its subtasks',async()=>{
 mock.rpc.mockResolvedValue({data:null,error:{message:'not found'}});const {result}=setup();
 await act(async()=>{await expect(result.current.upsertRule.mutateAsync({editingRuleId:null,payload})).rejects.toThrow('Backend noch nicht verfügbar');});
 expect(mock.from).not.toHaveBeenCalled();
});
it('preserves the package fields when backend support is available',async()=>{
 mock.rpc.mockResolvedValue({data:'2026-12-10',error:null});const {result}=setup();
 await act(async()=>{await result.current.upsertRule.mutateAsync({editingRuleId:null,payload});});
 expect(mock.insert).toHaveBeenCalledWith([expect.objectContaining({actions:payload.actions,created_by:'actor'})]);
});
it('does not add a backend requirement for legacy rules',async()=>{
 const {result}=setup();await act(async()=>{await result.current.upsertRule.mutateAsync({editingRuleId:null,payload:{...payload,actions:[{type:'create_task',payload:{title:'Legacy'}}]}});});
 expect(mock.rpc).not.toHaveBeenCalled();expect(mock.insert).toHaveBeenCalledOnce();
});
