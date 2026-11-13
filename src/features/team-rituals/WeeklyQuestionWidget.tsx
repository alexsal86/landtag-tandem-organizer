import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { useTeamRituals, type Snapshot, type RitualQuestion } from './data';
import { TeamEvents } from './TeamEvents';
import { berlinDay, isValidWeeklyAnswer } from './logic';

export function WeeklyQuestionWidget() {
  const { data, error, isPending, tenantId, userId } = useTeamRituals();
  if (isPending) return <p className="p-4">Team-Rituale werden geladen …</p>;
  if (error || !data || !tenantId) return <p role="alert" className="p-4">Team-Rituale konnten nicht geladen werden.</p>;
  return <RitualPanel key={`${tenantId}:${userId}:${data.week?.id ?? "none"}`} data={data} tenantId={tenantId} userId={userId} />;
}
function RitualPanel({ data, tenantId, userId }: { data: Snapshot; tenantId: string; userId?: string }) {
  const cache = useQueryClient();
  const ownAnswer = data.answers.find(a => a.user_id === userId)?.answer ?? '';
  const [answer, setAnswer] = useState(ownAnswer);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);
  async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    try {
      const result = await action();
      if (result.error) throw result.error;
      await cache.invalidateQueries({ queryKey: ['team-rituals', tenantId] });
      notify.success('Gespeichert');
    } catch (error: unknown) { notify.error('Speichern fehlgeschlagen', { description: error instanceof Error ? error.message : 'Bitte erneut versuchen.' }); }
    finally { setBusy(false); }
  }
  return <Card className="h-full overflow-auto"><CardHeader><CardTitle>Frage der Woche</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">Freiwillig, ohne Punkte oder Ranglisten. Antworten sind im eigenen Büro sichtbar.</p>
    {!data.enabled ? <p>Team-Rituale sind für dieses Büro ausgeschaltet.</p> : !data.own?.opted_in ? <p>Aktiviere deine Teilnahme unter „Meine Team-Rituale“.</p> : <>
      <p className="font-medium">{data.week?.question ?? 'Zurzeit ist keine Frage aktiv.'}</p>
      {data.week && <form key={data.week.id} className="space-y-2" onSubmit={e => { e.preventDefault(); void run(() => supabase.rpc('upsert_weekly_answer', { p_tenant: tenantId, p_week: data.week!.id, p_answer: answer })); }}>
        <Label htmlFor={`answer-${tenantId}`}>Deine freiwillige Antwort</Label>
        <Textarea id={`answer-${tenantId}`} maxLength={280} value={answer} onChange={e => setAnswer(e.target.value)} />
        <p className="text-xs text-muted-foreground">{Array.from(answer).length}/280 Zeichen</p>
        <Button disabled={busy || !isValidWeeklyAnswer(answer)} type="submit">Antwort speichern</Button>{' '}
        {ownAnswer && <Button disabled={busy} variant="outline" type="button" onClick={() => void run(async () => {
          const result = await supabase.rpc('delete_weekly_answer', { p_tenant: tenantId, p_week: data.week!.id });
          if (!result.error) setAnswer('');
          return result;
        })}>Eigene Antwort löschen</Button>}
      </form>}
      <ul className="space-y-2">{data.answers.map(a => <li key={a.user_id}><strong>{a.display_name}:</strong> <span className="whitespace-pre-wrap break-words">{a.answer}</span></li>)}</ul>
      <TeamEvents />
    </>}
    <Button variant="outline" onClick={() => setSettings(!settings)} aria-expanded={settings}>Meine Team-Rituale</Button>
    {settings && <ProfileForm key={JSON.stringify(data.own)} data={data} tenantId={tenantId} busy={busy} run={run} />}
    {data.admin && <details><summary className="cursor-pointer">Büroleitung: Freigabe und Fragenbank</summary>
      <Button className="my-2" disabled={busy} onClick={() => void run(() => supabase.rpc('configure_team_rituals', { p_tenant: tenantId, p_enabled: !data.enabled }))}>{data.enabled ? 'Für dieses Büro ausschalten' : 'Für dieses Büro einschalten'}</Button>
      <p className="text-xs text-muted-foreground">Änderungen gelten für kommende Wochen. Archivierte Fragen bleiben in vergangenen Wochen erhalten.</p>
      <QuestionForm tenantId={tenantId} busy={busy} run={run} />
      {data.questions.map(q => <QuestionForm key={`${q.id}:${q.question}:${q.active}`} tenantId={tenantId} question={q} busy={busy} run={run} />)}
    </details>}
  </CardContent></Card>;
}
type Runner = { busy: boolean; run: (action: () => PromiseLike<{ error: { message: string } | null }>) => Promise<void> };
function ProfileForm({ data, tenantId, busy, run }: { data: Snapshot; tenantId: string } & Runner) {
  const [optedIn, setOptedIn] = useState(data.own?.opted_in ?? false);
  const [visible, setVisible] = useState(data.own?.show_events ?? false);
  const [birthday, setBirthday] = useState(data.own?.birthday ?? '');
  const [year, setYear] = useState(data.own?.birth_year?.toString() ?? '');
  const [joined, setJoined] = useState(data.own?.joined_on ?? '');
  return <form className="space-y-3 border-t pt-3" onSubmit={e => { e.preventDefault(); void run(() => supabase.rpc('save_team_ritual_profile', {
    p_tenant: tenantId, p_opted_in: optedIn, p_show_events: visible, p_birthday: birthday || null, p_birth_year: year ? Number(year) : null, p_joined_on: joined || null,
  })); }}>
    <label className="flex gap-2"><input type="checkbox" checked={optedIn} onChange={e => setOptedIn(e.target.checked)} />Ich möchte teilnehmen</label>
    <p className="text-xs text-muted-foreground">Beim Beenden der Teilnahme werden deine Antworten gelöscht. Datumsangaben sind freiwillig und lassen sich durch Leeren der Felder entfernen.</p>
    <label className="block">Geburtstag (MM-TT, ohne Jahr)<Input placeholder="02-29" pattern="[0-9]{2}-[0-9]{2}" value={birthday} onChange={e => setBirthday(e.target.value)} /></label>
    <label className="block">Geburtsjahr (optional)<Input type="number" min={1900} max={Number(berlinDay(new Date()).slice(0, 4))} value={year} onChange={e => setYear(e.target.value)} /></label>
    <label className="block">Eintrittsdatum (optional)<Input type="date" value={joined} onChange={e => setJoined(e.target.value)} /></label>
    <label className="flex gap-2"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />Geburtstag und Jubiläum im Büro teilen</label>
    <p className="text-xs text-muted-foreground">Der 29. Februar wird in Jahren ohne Schalttag am 28. Februar angezeigt.</p>
    <Button disabled={busy}>Einstellungen speichern</Button>
  </form>;
}
function QuestionForm({ tenantId, question, busy, run }: { tenantId: string; question?: RitualQuestion } & Runner) {
  const [text, setText] = useState(question?.question ?? '');
  const [active, setActive] = useState(question?.active ?? true);
  return <form className="my-3 space-y-2" onSubmit={e => { e.preventDefault(); void run(() => supabase.rpc('save_team_question', { p_tenant: tenantId, p_id: question?.id ?? null, p_question: text, p_active: active })); }}>
    <label className="block">{question ? 'Frage bearbeiten' : 'Neue Frage'}<Input required maxLength={280} value={text} onChange={e => setText(e.target.value)} /></label>
    <label className="flex gap-2"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Aktiv</label>
    <Button disabled={busy || !text.trim()} variant="outline">{question ? 'Frage speichern' : 'Frage hinzufügen'}</Button>
  </form>;
}
