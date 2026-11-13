import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useTeamRituals, record, text, bool, list } from './data';
import { useRitualAction } from './actions';
import { berlinDay } from './logic';
import type { Json } from '@/integrations/supabase/types';
interface Quiz { id: string; name: string; facts: string[]; answered: boolean; lieIndex?: number; correct?: boolean }
function decodeQuiz(value: Json): Quiz | null {
  if (value === null) return null;
  const q = record(value);
  const answered = bool(q.answered);
  const quiz: Quiz = { id: text(q.id), name: text(q.subject_name), facts: list(q.facts).map(text), answered };
  if (quiz.facts.length !== 3) throw new Error('Ungültiges Quiz');
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
  return <Card className="h-full overflow-auto"><CardHeader><CardTitle>Zwei Wahrheiten, eine Lüge</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm text-muted-foreground">Das freiwillige Monatsquiz: Welche Aussage ist erfunden? Ohne Punkte oder Rangliste.</p>
    {!allowed ? <p>Aktiviere deine Teilnahme unter „Mitarbeiter → Team-Rituale“.</p>
      : quiz.isPending ? <p>Quiz wird geladen …</p>
      : quiz.error ? <p role="alert">Das Quiz konnte nicht geladen werden.</p>
      : !quiz.data ? <p>Noch keine freigegebenen Aussagen vorhanden. Ihr könnt sie unter „Meine drei Aussagen“ hinterlegen.</p>
      : <>
        <p className="font-medium">Drei Aussagen von {quiz.data.name}</p>
        <ol className="space-y-2">{quiz.data.facts.map((fact, index) => <li key={index}>
          <Button className="h-auto w-full justify-start whitespace-normal text-left" variant="outline" disabled={busy || quiz.data!.answered} onClick={() => void run(() => supabase.rpc('answer_two_truths_quiz', { p_tenant: tenantId!, p_quiz: quiz.data!.id, p_guess: index }))}>{index + 1}. {fact}</Button>
          {quiz.data!.answered && quiz.data!.lieIndex === index && <span className="text-sm font-medium">Das war die Lüge.</span>}
        </li>)}</ol>
        {quiz.data.answered && <p role="status">{quiz.data.correct ? 'Richtig geraten!' : 'Überraschung – jetzt kennst du die Auflösung.'}</p>}
      </>}
    <Button asChild variant="link"><Link to="/employee?tab=rituals">Meine drei Aussagen verwalten</Link></Button>
  </CardContent></Card>;
}
