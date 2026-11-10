import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActionPermission } from '@/hooks/useActionPermission';
import { useKnowledgePeople, useKnowledgeQuestions, useKnowledgeScope } from '../hooks/useKnowledgeQuestions';
import type { KnowledgeView } from '../types';
import { AskQuestionDialog } from './AskQuestionDialog';
import { KnowledgeQuestionCard } from './KnowledgeQuestionCard';

export function KnowledgeWorkspace() {
  const { tenantId, userId } = useKnowledgeScope();
  if (!tenantId || !userId) return <p className="p-6 text-muted-foreground">Bitte anmelden und ein Büro auswählen.</p>;
  return <KnowledgeWorkspaceContent key={`${userId}-${tenantId}`} />;
}
function KnowledgeWorkspaceContent() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [asking, setAsking] = useState<string | null>(null);
  const questionId = params.get('frage');
  const rawView = params.get('ansicht');
  const view: KnowledgeView = rawView === 'open' || rawView === 'mine' ? rawView : 'answers';
  const list = useKnowledgeQuestions(search, view, page, questionId);
  const { data: profiles, assignable, error: profileError } = useKnowledgePeople();
  const { allowed: canWrite } = useActionPermission('knowledge.write');
  const { allowed: canVerify } = useActionPermission('knowledge.verify');
  const navigateView = (next: KnowledgeView) => { setPage(0); setParams({ ansicht: next }); };
  return <div className="h-full overflow-auto"><section className="mx-auto max-w-4xl space-y-6 p-4 pb-12 sm:p-8" aria-label="Wissen">
    <header className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Wissen</h1><p className="mt-1 text-sm text-muted-foreground">Fragen stellen. Wissen miteinander teilen.</p></div>{canWrite && <Button onClick={() => setAsking('')}><Plus className="mr-2 h-4 w-4" />Frage stellen</Button>}</header>
    <div className="relative"><Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" /><Input className="h-14 pl-12 pr-12 text-base" aria-label="Wissen durchsuchen" placeholder="Was möchtest du wissen?" maxLength={300} value={search} onChange={event => { setSearch(event.target.value); setPage(0); if (questionId) setParams({ ansicht: view }); }} />{(list.isFetching || list.debouncing) && <Loader2 aria-label="Suche läuft" className="absolute right-4 top-4 h-5 w-5 animate-spin text-muted-foreground" />}</div>
    <nav className="flex flex-wrap gap-2" aria-label="Wissensansichten">{([['answers', 'Antworten'], ['open', 'Offene Fragen'], ['mine', 'Meine Beiträge']] as const).map(([key, label]) => <Button key={key} variant="ghost" className={view === key && !questionId ? 'bg-primary/10 text-primary hover:bg-primary/15' : undefined} aria-current={view === key && !questionId ? 'page' : undefined} onClick={() => navigateView(key)}>{label}</Button>)}</nav>
    {questionId && <Button variant="ghost" onClick={() => navigateView(view)}>← Zur Übersicht</Button>}
    {profileError && <p role="alert" className="text-sm text-muted-foreground">Mitarbeiternamen konnten nicht geladen werden.</p>}
    {list.isError ? <div role="alert" className="rounded-lg border border-destructive/30 p-5"><p>Wissen konnte nicht geladen werden.</p><Button className="mt-3" variant="outline" onClick={() => void list.refetch()}>Erneut versuchen</Button></div> : list.isPending || list.debouncing ? <p className="py-8 text-center text-muted-foreground" role="status">{search ? 'Antworten werden gesucht …' : 'Wissen wird geladen …'}</p> : list.data?.length ? <div className="space-y-4">{list.data.map(question => <KnowledgeQuestionCard key={question.id} question={question} query={search} profiles={profiles} assignable={assignable} canWrite={canWrite} canVerify={canVerify} onOpen={() => setParams({ frage: question.id, ansicht: view })} />)}</div> : <div className="rounded-lg border border-dashed p-8 text-center"><h2 className="font-medium">{questionId ? 'Frage nicht verfügbar' : search ? 'Keine passenden Antworten gefunden' : view === 'open' ? 'Keine offenen Fragen' : view === 'mine' ? 'Noch keine eigenen Beiträge' : 'Hier entsteht euer gemeinsames Wissen'}</h2><p className="mt-2 text-sm text-muted-foreground">{questionId ? 'Die Frage existiert nicht oder du hast keinen Zugriff.' : search ? 'Stelle deine Frage im Büro. Die Antwort bleibt hier auffindbar.' : view === 'open' ? 'Alle bisherigen Fragen wurden beantwortet.' : 'Eine Frage ist der Anfang. Kategorien oder Schlagwörter brauchst du nicht.'}</p>{!questionId && canWrite && <Button className="mt-4" onClick={() => setAsking(search)}>{search ? 'Diese Frage stellen' : 'Frage stellen'}</Button>}</div>}
    {!questionId && !list.isError && !list.isPending && (page > 0 || list.data?.length === 20) && <div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page === 0 || list.isFetching} onClick={() => setPage(value => value - 1)}>Zurück</Button><span className="text-sm">Seite {page + 1}</span><Button variant="outline" disabled={list.data?.length !== 20 || list.isFetching} onClick={() => setPage(value => value + 1)}>Weiter</Button></div>}
    <footer className="border-t pt-4"><a className="text-sm text-muted-foreground hover:underline" href="/dossiers">Bisheriger Wissensbereich</a></footer>
    {asking !== null && <AskQuestionDialog initialQuestion={asking} onClose={() => setAsking(null)} onCreated={id => { setAsking(null); setSearch(''); setPage(0); setParams({ ansicht: 'open', frage: id }); }} />}
  </section></div>;
}
