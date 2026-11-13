import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useTeamRituals, record, text, bool, list } from './data';
import { useRitualAction } from './actions';
import { ritualMonth } from './history';
import { berlinDay } from './logic';
import type { Json } from '@/integrations/supabase/types';
interface QuizPrompt { id: string; name: string; facts: string[]; month: string }
interface Quiz extends QuizPrompt { answered: boolean; lieIndex?: number; correct?: boolean }
function decodePrompt(value: Json): QuizPrompt {
  const q = record(value);
  const prompt = { id: text(q.id), name: text(q.subject_name), facts: list(q.facts).map(text), month: text(q.month) };
  if (prompt.facts.length !== 3 || !/^\d{4}-\d{2}-01$/.test(prompt.month)) throw new Error('Ungültiges Quiz');
  return prompt;
}
function decodeQuiz(value: Json): Quiz | null {
  if (value === null) return null;
  const q = record(value);
  const answered = bool(q.answered);
  const quiz: Quiz = { ...decodePrompt(value), answered };
  if (answered) {
    if (typeof q.lie_index !== 'number' || !Number.isInteger(q.lie_index) || q.lie_index < 0 || q.lie_index > 2) throw new Error('Ungültige Auflösung');
    quiz.lieIndex = q.lie_index;
    quiz.correct = bool(q.correct);
  }
  return quiz;
}
export function TwoTruthsWidget() {
  const { data, tenantId, userId } = useTeamRituals();
  const allowed = !!data?.enabled && !!data.own?.opted_in;
  const { busy, run } = useRitualAction(tenantId);
  const quiz = useQuery({
    queryKey: ['team-quiz', tenantId, userId, berlinDay(new Date()).slice(0, 7)],
    enabled: allowed && !!tenantId && !!userId,
    refetchInterval: allowed ? 60_000 : false,
    queryFn: async () => {
      const result = await supabase.rpc('team_two_truths_snapshot', { p_tenant: tenantId! });
      if (result.error) throw result.error;
      return decodeQuiz(result.data);
    },
  });
  const archive = useQuery({
    queryKey: ['team-quiz', tenantId, userId, 'archive', berlinDay(new Date()).slice(0, 7)],
    enabled: allowed && !!tenantId && !!userId,
    refetchInterval: allowed ? 60_000 : false,
    queryFn: async () => {
      const result = await supabase.rpc('team_two_truths_archive', { p_tenant: tenantId! });
      if (result.error) throw result.error;
      return list(result.data).map(decodePrompt);
    },
  });
  return <Card className="h-full overflow-auto"><CardHeader><CardTitle>Zwei Wahrheiten, eine Lüge</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm text-muted-foreground">Das freiwillige Monatsquiz: Welche Aussage ist erfunden? Jeden Monat neue freigegebene Aussagen; bereits verwendete bleiben im Archiv. Ohne Punkte oder Rangliste.</p>
    {!allowed ? <p>Aktiviere deine Teilnahme unter „Mitarbeiter → Team-Rituale“.</p>
      : quiz.isPending ? <p>Quiz wird geladen …</p>
      : quiz.error ? <p role="alert">Das Quiz konnte nicht geladen werden.</p>
      : !quiz.data ? <p>Keine unverwendeten, freigegebenen Aussagen vorhanden. Hinterlegt neue Aussagen unter „Meine drei Aussagen“ für das nächste Quiz.</p>
      : <div className={quiz.data.answered ? "space-y-3 border-t pt-3 text-muted-foreground" : "space-y-3"}>
        {quiz.data.answered && <h3 className="text-sm font-medium">Archiv · bereits beantwortet</h3>}
        <p className="font-medium">Drei Aussagen von {quiz.data.name}</p>
        <p className="text-xs text-muted-foreground">Gestellt im {ritualMonth(quiz.data.month)}</p>
        <ol className="space-y-2">{quiz.data.facts.map((fact, index) => <li key={index}>
          <Button className="h-auto w-full justify-start whitespace-normal text-left" variant="outline" disabled={busy || quiz.data!.answered} onClick={() => void run(() => supabase.rpc('answer_two_truths_quiz', { p_tenant: tenantId!, p_quiz: quiz.data!.id, p_guess: index }))}>{index + 1}. {fact}</Button>
          {quiz.data!.answered && quiz.data!.lieIndex === index && <span className="text-sm font-medium">Das war die Lüge.</span>}
        </li>)}</ol>
        {quiz.data.answered && <p role="status">{quiz.data.correct ? 'Richtig geraten!' : 'Überraschung – jetzt kennst du die Auflösung.'}</p>}
      </div>}
    {allowed && <section className="border-t pt-3 text-muted-foreground" aria-label="Quiz-Archiv">
      <h3 className="text-sm font-medium">Archiv vergangener Monatsquiz</h3>
      {archive.isPending ? <p className="text-sm">Archiv wird geladen …</p>
        : archive.error ? <p role="alert">Das Archiv konnte nicht geladen werden.</p>
        : !archive.data?.length ? <p className="text-sm">Noch keine vergangenen Monatsquiz.</p>
        : <div className="divide-y">{archive.data.map(entry => <details key={entry.id} className="py-2">
          <summary className="cursor-pointer text-sm">{entry.name} · gestellt im {ritualMonth(entry.month)}</summary>
          <ol className="list-inside list-decimal space-y-1 pt-2 text-sm">{entry.facts.map((fact, index) => <li className="whitespace-pre-wrap break-words" key={index}>{fact}</li>)}</ol>
        </details>)}</div>}
    </section>}
    <Button asChild variant="link"><Link to="/employee?tab=rituals">Meine drei Aussagen verwalten</Link></Button>
  </CardContent></Card>;
}
