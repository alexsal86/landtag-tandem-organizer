import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { OfficeRoutineTemplates } from './OfficeRoutineTemplates';
import type { AutomationRuleRecordView } from './automationShared';
afterEach(cleanup);
it('opens a selected seasonal template and reuses an existing rule instead of making a copy',()=>{
 const onUse=vi.fn(),onEdit=vi.fn();
 const rule:AutomationRuleRecordView={id:'r',name:'Karten',module:'tasks',description:null,trigger_type:'schedule',trigger_config:{},actions:[{type:'run_annual_routine',payload:{office_template_id:'annual-greetings'}}],conditions:{all:[]},enabled:true,updated_at:'2026-01-01'};
 render(<OfficeRoutineTemplates rules={[rule]} onUse={onUse} onEdit={onEdit} canEdit />);
 fireEvent.click(screen.getByRole('button',{name:'Eingerichtete Routine bearbeiten'}));expect(onEdit).toHaveBeenCalledWith(rule);expect(onUse).not.toHaveBeenCalled();
 fireEvent.click(screen.getAllByRole('button',{name:'Vorlage übernehmen'})[0]);expect(onUse).toHaveBeenCalledWith('annual-budget');
});
it('keeps template activation unavailable without office administration rights',()=>{
 render(<OfficeRoutineTemplates rules={[]} onUse={vi.fn()} onEdit={vi.fn()} canEdit={false} />);
 expect(screen.getAllByRole('button',{name:'Vorlage übernehmen'})).toHaveLength(5);
 for(const button of screen.getAllByRole('button'))expect(button).toBeDisabled();
});
