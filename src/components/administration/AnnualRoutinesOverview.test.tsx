import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnualRoutinesOverview } from './AnnualRoutinesOverview';
import type { AutomationRuleRecordView } from './automationShared';
const mock = vi.hoisted(() => ({ data: [] as unknown[], error: null as Error | null, navigate: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mock.data, isLoading: false, error: mock.error, refetch: vi.fn() }) }));
vi.mock('@/hooks/useTenant', () => ({ useTenant: () => ({ currentTenant: { id:'office' } }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mock.navigate }));
const rule = (id: string, month: string, system = false): AutomationRuleRecordView => ({ id,name:id,description:null,module:'tasks',trigger_type:'manual',trigger_config:{schedule_kind:'annual',month,day:'1',hour:'9'},actions:[{type:'run_annual_routine',payload:{system_function:system?'execute_reset_vacation_days':''}}],conditions:{all:[]},enabled:true,updated_at:'2026-01-01' });
const rules = [rule('Rückblick','1'),rule('Personalaktion','3',true),rule('Planung','12')];
const props = () => ({rules,onEdit:vi.fn(),onRun:vi.fn(),onNew:vi.fn(),canEdit:true,runningRuleId:null as string|null});
beforeEach(() => { HTMLElement.prototype.scrollIntoView=vi.fn(); mock.data=[{due_month:1,due_day:1,automation_rule_id:'Rückblick',completion:{completed_at:'2026-01-01',linked_task_id:null}}]; mock.error=null; mock.navigate.mockReset(); });
afterEach(cleanup);
describe('Jahresroutinen-Zeitleiste', () => {
  it('filters open and completed routines without changing the annual overview', () => {
    render(<AnnualRoutinesOverview {...props()} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    const filters=screen.getByRole('group',{name:'Routinen filtern'});
    fireEvent.click(within(filters).getByRole('button',{name:'Erledigt'}));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article',{name:'Rückblick'})).toBeInTheDocument();
    fireEvent.click(within(filters).getByRole('button',{name:'Offen'}));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByRole('article',{name:'Rückblick'})).not.toBeInTheDocument();
  });
  it('adds in the selected empty month and keeps edit in the existing rule editor', () => {
    const p=props();render(<AnnualRoutinesOverview {...p} />);
    fireEvent.click(screen.getByRole('button',{name:'Jahresroutine für Februar hinzufügen'}));expect(p.onNew).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button',{name:'Planung bearbeiten'}));expect(p.onEdit).toHaveBeenCalledWith(rules[2]);
    fireEvent.click(screen.getByLabelText('Monate ohne Routine anzeigen'));
    expect(screen.queryByRole('region',{name:/Februar \d+/})).not.toBeInTheDocument();
  });
  it('month navigation reveals a hidden empty month and scrolls to it', () => {
    render(<AnnualRoutinesOverview {...props()} />);
    fireEvent.click(screen.getByLabelText('Monate ohne Routine anzeigen'));
    fireEvent.click(screen.getByRole('button',{name:'Februar: 0 Routinen'}));
    expect(screen.getByRole('region',{name:/Februar \d+/})).toBeInTheDocument();
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });
  it('requires confirmation before system actions and blocks edits without permission', () => {
    const p=props();const {rerender}=render(<AnnualRoutinesOverview {...p} />);
    fireEvent.click(within(screen.getByRole('article',{name:'Personalaktion'})).getByRole('button',{name:'Ausführen'}));
    expect(p.onRun).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Ausführen'}));expect(p.onRun).toHaveBeenCalledWith(rules[1]);
    rerender(<AnnualRoutinesOverview {...p} canEdit={false} />);
    expect(screen.getByRole('button',{name:'Neue Jahresroutine'})).toBeDisabled();expect(screen.getByRole('button',{name:'Planung bearbeiten'})).toBeDisabled();
  });
  it('opens linked tasks instead of executing again', () => {
    mock.data.push({due_month:12,due_day:1,automation_rule_id:'Planung',completion:{completed_at:null,linked_task_id:'task-id'}});
    const p=props();render(<AnnualRoutinesOverview {...p} />);
    const card=screen.getByRole('article',{name:'Planung'});expect(within(card).queryByRole('button',{name:'Ausführen'})).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button',{name:'Aufgabe öffnen'}));expect(mock.navigate).toHaveBeenCalledWith('/mywork?tab=tasks&highlight=task-id');
  });
  it('shows a load error instead of pretending the year has no routines', () => {
    mock.error=new Error('offline');render(<AnnualRoutinesOverview {...props()} />);
    expect(screen.getByText('Jahresstatus konnte nicht geladen werden')).toBeInTheDocument();expect(screen.queryByText('Keine Jahresroutinen')).not.toBeInTheDocument();
  });
});
