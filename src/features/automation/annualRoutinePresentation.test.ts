import { describe, expect, it } from 'vitest';
import { berlinCalendar, matchesRoutineFilter, presentAnnualRoutines, type RoutineRecord } from './annualRoutinePresentation';
import type { AutomationRuleRecordView } from '@/components/administration/automationShared';
export const routine = (id: string, month: string, day: string, system = false): AutomationRuleRecordView => ({ id, name: id, description: null, module: 'tasks', trigger_type: 'schedule', trigger_config: { schedule_kind: 'annual', month, day, hour: '9', timezone: 'Europe/Berlin' }, conditions: { all: [] }, actions: [{ type: 'run_annual_routine', payload: { system_function: system ? 'execute_reset_vacation_days' : '' } }], enabled: true, updated_at: '2026-01-01T00:00:00Z' });
describe('Jahresroutinen-Darstellung', () => {
  it('sorts by actual deadlines and computes counters from completion, not month alone', () => {
    const rules = [routine('future','12','15'),routine('late','11','1'),routine('done','1','1')];
    const records: RoutineRecord[] = [{ automation_rule_id:'done',due_month:1,due_day:1,completion:{completed_at:'2026-01-02T12:00:00Z',linked_task_id:null} }];
    const result = presentAnnualRoutines(rules,records,new Date('2026-11-10T12:00:00Z'));
    expect(result.map(item=>[item.rule.id,item.status,item.days])).toEqual([['done','completed',-313],['late','overdue',-9],['future','upcoming',35]]);
    expect(result.filter(item=>matchesRoutineFilter(item.status,'open'))).toHaveLength(2);
    expect(result.filter(item=>matchesRoutineFilter(item.status,'done'))).toHaveLength(1);
  });
  it('clamps month-end and preserves invalid schedules for editing', () => {
    const leap = routine('month-end','2','31'); leap.trigger_config.month_end='true';
    const result = presentAnnualRoutines([leap,routine('invalid','13','1')],[],new Date('2026-02-01T12:00:00Z'));
    expect(result[0].due).toBe('2026-02-28'); expect(result[1].due).toBeNull(); expect(result[1].month).toBeNull();
  });
  it('uses the package completion date rather than the planning start for overdue status', () => {
    const report=routine('report','11','1');report.actions[0].payload={routine_deadline_month:'1',routine_deadline_day:'31'};
    const item=presentAnnualRoutines([report],[],new Date('2026-11-10T12:00:00Z'))[0];
    expect(item.start).toBe('2026-11-01');expect(item.due).toBe('2027-01-31');expect(item.status).toBe('upcoming');expect(item.days).toBe(82);
  });
  it('uses Berlin date across UTC year boundaries and DST', () => {
    expect(berlinCalendar(new Date('2026-12-31T23:30:00Z'))).toEqual({year:2027,month:1,day:1});
    expect(presentAnnualRoutines([routine('dst','3','30')],[],new Date('2026-03-28T23:30:00Z'))[0].days).toBe(1);
  });
});
