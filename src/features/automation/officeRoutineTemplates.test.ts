import { describe,expect,it } from 'vitest';
import { OFFICE_ROUTINE_TEMPLATES,officeRoutineDeadline,parseRoutineSteps,routineConfirmationMissing,validateOfficeRoutine } from './officeRoutineTemplates';
import { RULE_TEMPLATES } from '@/components/administration/automationRule/constants';
import { unconfirmedOfficeRoutine } from '../../../supabase/functions/_shared/officeRoutinePlan';
describe('Saisonale Büropakete',()=>{
 it('provides the five office workflows through the existing annual rule action',()=>{
  expect(OFFICE_ROUTINE_TEMPLATES.map(t=>t.id)).toEqual(['annual-budget','annual-greetings','annual-summer-tour','annual-office-planning','annual-mandate-report']);
  for(const t of OFFICE_ROUTINE_TEMPLATES){
   const rule=RULE_TEMPLATES.find(rule=>rule.id===t.id)!;
   expect(rule.actions).toHaveLength(1);expect(rule.actions[0].type).toBe('run_annual_routine');
   expect('officeTemplateId' in rule.actions[0]&&rule.actions[0].officeTemplateId).toBe(t.id);
   expect(parseRoutineSteps(t.steps).length).toBeGreaterThanOrEqual(4);
   expect(validateOfficeRoutine({routineDeadlineMonth:t.deadlineMonth,routineDeadlineDay:t.deadlineDay,routineSteps:t.steps,routineRequiresConfirmation:t.confirmAnnually})).toBeNull();
  }
 });
 it('separates planning start and finish, including the following January',()=>{
  expect(officeRoutineDeadline({routine_deadline_month:'1',routine_deadline_day:'31'},'2026-11-01')).toBe('2027-01-31');
  expect(officeRoutineDeadline({routine_deadline_month:'12',routine_deadline_day:'10'},'2026-09-15')).toBe('2026-12-10');
  expect(officeRoutineDeadline({routine_deadline_month:'2',routine_deadline_day:'31'},'2027-02-01')).toBe('2027-02-28');
 });
 it('requires annual budget date confirmation and expires it next year in Berlin',()=>{
  const payload={routine_requires_confirmation:'true',routine_confirmed_year:'2026'};
  expect(routineConfirmationMissing(payload,2026)).toBe(false);expect(routineConfirmationMissing(payload,2027)).toBe(true);
  expect(unconfirmedOfficeRoutine([{type:'run_annual_routine',payload}],new Date('2026-12-31T23:30:00Z'))).toBe(true);
  expect(unconfirmedOfficeRoutine([{type:'run_annual_routine',payload}],new Date('2026-06-01'))).toBe(false);
 });
 it('orders work from the largest lead time to the final step and rejects malformed steps',()=>{
  expect(parseRoutineSteps('0 | Versand\n14 | Druck')).toEqual([{days_before:14,title:'Druck'},{days_before:0,title:'Versand'}]);
  expect(()=>parseRoutineSteps('14 Druck')).toThrow();expect(()=>parseRoutineSteps('366 | Druck')).toThrow();expect(()=>parseRoutineSteps(Array(21).fill('0 | X').join('\n'))).toThrow();
  expect(validateOfficeRoutine({routineDeadlineMonth:'12',routineSteps:'14 | Druck'})).not.toBeNull();
 });
});
