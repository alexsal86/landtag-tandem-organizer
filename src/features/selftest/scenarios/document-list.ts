import { visibleDocuments, nextDocumentSort, selectVisibleDocuments } from '@/features/documents/documentListModel';
import type { TestScenario } from '../types';

const documents = [
  { id: 'a', title: 'Datei 10', file_name: 'plan.pdf', description: 'Haushalt', category: 'planung', folder_id: null, created_at: '2026-01-01T10:00:00Z' },
  { id: 'b', title: 'Datei 2', file_name: 'bericht.pdf', category: 'berichte', folder_id: null, created_at: '2026-02-01T10:00:00Z' },
  { id: 'c', title: 'Intern', file_name: 'intern.pdf', category: 'planung', folder_id: 'folder', created_at: '2026-03-01T10:00:00Z' },
];
export const documentListScenario: TestScenario = {
  id: 'document-list', title: 'Dokumente: Suche, Kategorien, Sortierung und Auswahl',
  description: 'Gemeinsame Listenregeln für Karten und Tabelle, ohne Testdatensätze anzulegen.',
  touches: [], features: ['documents'],
  steps: [
    { id: 'filters', label: 'Suche und Kategorie-Chips im aktuellen Ordner kombinieren', kind: 'logic', run: async () => {
      const options = { search: '', categories: [], folderId: null, sort: { key: 'title', direction: 'asc' } } as const;
      return { ok: visibleDocuments(documents, options).length === 2
        && visibleDocuments(documents, { ...options, categories: ['planung', 'berichte'] }).length === 2
        && visibleDocuments(documents, { ...options, categories: ['berichte'] })[0]?.id === 'b'
        && visibleDocuments(documents, { ...options, search: ' HAUSHALT ' })[0]?.id === 'a'
        && visibleDocuments(documents, { ...options, folderId: 'folder' })[0]?.id === 'c',
        message: 'Textsuche, mehrere Kategorie-Chips und Ordnergrenzen werden gemeinsam angewendet.' };
    } },
    { id: 'sort', label: 'Titel und Erstelldatum in beiden Richtungen sortieren', kind: 'logic', run: async () => {
      const options = { search: '', categories: [], folderId: null };
      const asc = nextDocumentSort({ key: 'created_at', direction: 'desc' }, 'title');
      const desc = nextDocumentSort(asc, 'title');
      return { ok: asc.direction === 'asc' && desc.direction === 'desc'
        && visibleDocuments(documents, { ...options, sort: asc })[0]?.id === 'b'
        && visibleDocuments(documents, { ...options, sort: desc })[0]?.id === 'a'
        && visibleDocuments(documents, { ...options, sort: { key: 'created_at', direction: 'desc' } })[0]?.id === 'b'
        && visibleDocuments(documents, { ...options, sort: { key: 'created_at', direction: 'asc' } })[0]?.id === 'a'
        && documents[0].id === 'a', message: 'Natürliche Titelsortierung und chronologische Datumssortierung verändern die Quelldaten nicht.' };
    } },
    { id: 'selection', label: 'Mehrfachauswahl und Alle auswählen auf sichtbare Dokumente begrenzen', kind: 'logic', run: async () => {
      const original = new Set(['a']);
      const all = selectVisibleDocuments(original, ['a', 'b'], true);
      const cleared = selectVisibleDocuments(all, ['a', 'b'], false);
      return { ok: all.size === 2 && all.has('a') && all.has('b') && !all.has('c') && cleared.size === 0 && original.size === 1,
        message: 'Sichtbare Dokumente gemeinsam auswählen und abwählen, ohne versteckte Dokumente einzubeziehen.' };
    } },
  ],
};
