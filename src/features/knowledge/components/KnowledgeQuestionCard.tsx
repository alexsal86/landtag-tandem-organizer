import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, History, Pencil } from 'lucide-react';
import EnhancedLexicalEditor from '@/components/lexical/EnhancedLexicalEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { answerExcerpt, answerText, asObject, effectiveReviewStatus, REVIEW_LABELS } from '../logic';
import { useKnowledgeHistory, useKnowledgeWrite, useKnowledgeQuestion } from '../hooks/useKnowledgeQuestions';
import type { KnowledgeCard, KnowledgeSummary } from '../types';
import type { TenantProfileOption } from '@/hooks/useTenantProfiles';
import { KnowledgeAnswerEditor } from './KnowledgeAnswerEditor';
import { KnowledgeAttachments } from './KnowledgeAttachments';

const formatDate = (value: string) => new Date(value).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const EVENT_NAMES: Record<string, string> = { question_created: 'Frage gestellt', answer_changed: 'Antwort oder Anhänge geändert', verified: 'Als aktuell bestätigt', review_requested: 'Überprüfung angefordert', assignee_changed: 'Zuständigkeit geändert' };

function FullKnowledgeQuestionCard({ question, profiles, assignable, canWrite, canVerify, query, onOpen }: {
  question: KnowledgeCard; profiles: TenantProfileOption[]; assignable: TenantProfileOption[]; canWrite: boolean; canVerify: boolean; query: string; onOpen: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [reviewRevision, setReviewRevision] = useState(question.revision);
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState('');
  const [, tick] = useState(0);
  const write = useKnowledgeWrite();
  const history = useKnowledgeHistory(question.id, historyOpen);
  const clock = useMemo(() => ({ server: Date.parse(question.server_now), received: Date.now() }), [question.server_now]);
  const now = clock.server + Date.now() - clock.received;
  useEffect(() => {
    if (!question.review_due_at) return;
    const remaining = Date.parse(question.review_due_at) - (clock.server + Date.now() - clock.received);
    if (remaining <= 0) return;
    const timer = setTimeout(() => tick(value => value + 1), Math.min(remaining + 30, 2147483647));
    return () => clearTimeout(timer);
  }, [clock, question.review_due_at]);
  const status = effectiveReviewStatus(question, now);
  const name = (id: string | null) => id ? profiles.find(profile => profile.user_id === id)?.display_name || 'Ehemaliger Mitarbeiter' : 'Noch nicht zugeordnet';
  const validContent = useMemo(() => {
    try { return question.answer_content && answerText(question.answer_content) ? JSON.stringify(question.answer_content) : undefined; }
    catch { return undefined; }
  }, [question.answer_content]);
  return <Card><CardContent className="space-y-4 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h2 className="min-w-0 flex-1 text-lg font-semibold break-words"><button className="text-left hover:underline" onClick={onOpen}>{question.title}</button></h2>
      <Badge variant={question.answered_at ? status === 'verified' ? 'secondary' : 'outline' : 'default'}>{question.answered_at ? REVIEW_LABELS[status] : 'Offene Frage'}</Badge>
    </div>
    {question.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{question.description}</p>}
    {query && question.answer_text.length > 300 && <p className="border-l-2 pl-3 text-sm text-muted-foreground" aria-label="Antwortauszug">{answerExcerpt(question.answer_text, query)}</p>}
    {editing ? <KnowledgeAnswerEditor question={question} onClose={() => setEditing(false)} /> : question.answered_at ? <>
      <EnhancedLexicalEditor key={`${question.id}-${question.answer_revision}`} knowledgeMode editable={false} showToolbar={false} content={question.answer_text} contentNodes={validContent} onChange={() => {}} />
      <KnowledgeAttachments question={question} canWrite={canWrite} />
    </> : <p className="text-sm text-muted-foreground">Diese Frage wartet auf eine Antwort.</p>}
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <span>Gefragt von {name(question.created_by)} · {formatDate(question.created_at)}</span>
      {question.answered_at && <span>Verantwortlich: {name(question.assigned_to || question.answered_by)}</span>}
      {question.answer_updated_at && <span>Aktualisiert: {formatDate(question.answer_updated_at)}</span>}
      {status === 'verified' && question.verified_at && <span>Bestätigt von {name(question.verified_by)} · {formatDate(question.verified_at)}</span>}
      {question.review_due_at && <span>Prüftermin: {formatDate(question.review_due_at)}</span>}
    </div>
    {canWrite ? <div className="flex flex-wrap items-center gap-2"><Label className="text-xs text-muted-foreground" htmlFor={`assignee-${question.id}`}>Zuständig</Label><select id={`assignee-${question.id}`} className="max-w-full rounded border bg-background px-2 py-1 text-sm" value={question.assigned_to || ''} disabled={write.isPending} onChange={async event => {
      setError('');
      try { await write.mutateAsync({ name: 'knowledge_qa_set_assignee', args: { p_question: question.id, p_expected_revision: question.revision,
        // @ts-expect-error Generated RPC types omit nullability; the SQL function accepts null to clear the assignee.
        p_assigned_to: event.target.value || null } }); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Zuständigkeit konnte nicht geändert werden.'); }
    }}><option value="">Noch nicht zugeordnet</option>{question.assigned_to && !assignable.some(profile => profile.user_id === question.assigned_to) && <option value={question.assigned_to}>{name(question.assigned_to)}</option>}{assignable.map(profile => <option key={profile.user_id} value={profile.user_id}>{profile.display_name || 'Unbekannt'}</option>)}</select></div> : !question.answered_at && question.assigned_to && <p className="text-sm">Zuständig: {name(question.assigned_to)}</p>}
    {!editing && <div className="flex flex-wrap gap-2">
      {canWrite && <Button variant={question.answered_at ? 'outline' : 'default'} size="sm" onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" />{question.answered_at ? 'Antwort bearbeiten' : 'Beantworten'}</Button>}
      {question.answered_at && canVerify && <><Button variant="outline" size="sm" disabled={write.isPending} onClick={() => { setReviewRevision(question.revision); setChecking(value => !value); }}><CheckCheck className="mr-2 h-4 w-4" />Als aktuell geprüft markieren</Button><Button variant="ghost" size="sm" disabled={write.isPending} onClick={async () => {
        setError(''); try { await write.mutateAsync({ name: 'knowledge_qa_review', args: { p_question: question.id, p_expected_revision: question.revision, p_verified: false } }); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Prüfung konnte nicht angefordert werden.'); }
      }}>Überprüfung anfordern</Button></>}
      <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(value => !value)} aria-expanded={historyOpen}><History className="mr-2 h-4 w-4" />Verlauf</Button>
    </div>}
    {checking && !editing && <div className="space-y-2 rounded border bg-muted/20 p-3">
      <p className="text-sm">Du bestätigst, dass du diese Antwort auf Aktualität geprüft hast.</p>
      <Label htmlFor={`due-${question.id}`}>Erneut prüfen am (optional)</Label><input className="block max-w-full rounded border bg-background p-2 text-sm" id={`due-${question.id}`} type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} />
      <div className="flex gap-2"><Button size="sm" disabled={write.isPending} onClick={async () => {
        setError('');
        try {
          if (dueAt && (!Number.isFinite(Date.parse(dueAt)) || Date.parse(dueAt) <= now)) throw new Error('Der Prüftermin muss in der Zukunft liegen.');
          await write.mutateAsync({ name: 'knowledge_qa_review', args: { p_question: question.id, p_expected_revision: reviewRevision, p_verified: true, p_due_at: dueAt ? new Date(dueAt).toISOString() : undefined } });
          setChecking(false); setDueAt('');
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Bestätigung konnte nicht gespeichert werden.'); }
      }}>Aktualität bestätigen</Button><Button variant="ghost" size="sm" onClick={() => setChecking(false)}>Abbrechen</Button></div>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {historyOpen && <section aria-label="Änderungsverlauf" className="space-y-2 border-t pt-3">
      {history.isLoading && <p className="text-sm">Verlauf wird geladen …</p>}
      {history.isError && <p role="alert" className="text-sm text-destructive">Verlauf konnte nicht geladen werden.</p>}
      {history.data?.map(event => <details key={event.id} className="rounded border p-2 text-sm"><summary className="cursor-pointer">{EVENT_NAMES[event.event_type] || 'Änderung'} · {name(event.actor_id)} · {formatDate(event.created_at)}</summary><p className="mt-2 whitespace-pre-wrap">{String(asObject(event.snapshot)?.answer_text || 'Noch keine Antwort')}</p></details>)}
      {history.data?.length === 100 && <p className="text-xs text-muted-foreground">Die letzten 100 Änderungen werden angezeigt.</p>}
    </section>}
  </CardContent></Card>;
}

export function KnowledgeQuestionCard(props: {
  question: KnowledgeSummary; profiles: TenantProfileOption[]; assignable: TenantProfileOption[];
  canWrite: boolean; canVerify: boolean; query: string; onOpen: () => void; detail?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const detail = useKnowledgeQuestion(props.detail || expanded ? props.question.id : null);
  if (props.detail || expanded) {
    if (detail.isError) return <p role="alert">Frage konnte nicht geladen werden. <Button onClick={() => void detail.refetch()}>Erneut versuchen</Button></p>;
    if (detail.isPending) return <p role="status">Frage wird geladen …</p>;
    if (!detail.data) return <p>Frage nicht verfügbar.</p>;
    return <FullKnowledgeQuestionCard {...props} question={detail.data} />;
  }
  const question = props.question;
  return <Card><CardContent className="space-y-4 p-6">
    <div className="flex flex-wrap justify-between gap-2">
      <h2 className="text-lg font-semibold"><button onClick={props.onOpen}>{question.title}</button></h2>
      <Badge>{question.answered_at ? REVIEW_LABELS[effectiveReviewStatus(question)] : 'Offene Frage'}</Badge>
    </div>
    {question.description && <p className="text-sm text-muted-foreground">{question.description}</p>}
    <p className="whitespace-pre-wrap text-sm">{question.answered_at ? question.answer_excerpt : 'Diese Frage wartet auf eine Antwort.'}</p>
    <Button variant="outline" onClick={() => setExpanded(true)}>Vollständig anzeigen</Button>
  </CardContent></Card>;
}
