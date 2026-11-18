import type { GridEntity } from './historyFields';

export type HistoryWorkspaceSection = GridEntity | 'deputies' | 'issues' | 'state_lists' | 'factions' | 'quality' | 'sources';
export const historyWorkspaceTabs: ReadonlyArray<{ id: Exclude<HistoryWorkspaceSection, 'state_lists'>; label: string }> = [
  { id: 'periods', label: '1 · Legislaturperioden' },
  { id: 'districts', label: '2 · Wahlkreise' },
  { id: 'mandates', label: '3 · Abgeordnete der Periode' },
  { id: 'candidacies', label: '4 · Kandidaturen, Ergebnisse & Landeslisten' },
  { id: 'factions', label: '5 · Fraktionen & Parteien' },
  { id: 'quality', label: '6 · Datenqualität' },
  { id: 'sources', label: '7 · Quellenabgleich' },
  { id: 'issues', label: '8 · Problemfälle' },
  { id: 'deputies', label: '9 · Gesamtregister' },
];
export function historyWorkspaceTab(section: HistoryWorkspaceSection) {
  return section === 'state_lists' ? 'candidacies' : section;
}
export function isHistoryWorkspaceSection(value: string): value is HistoryWorkspaceSection {
  return value === 'state_lists' || historyWorkspaceTabs.some(tab => tab.id === value);
}
