import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfettiAnimation } from '@/components/celebrations/ConfettiAnimation';
import { useTeamRituals } from './data';
import { berlinDay, upcomingAnniversaries, upcomingTeamEvents } from './logic';
export function TeamEvents() {
  const { data } = useTeamRituals();
  const [celebration, setCelebration] = useState(0);
  if (!data?.enabled) return null;
  const today = berlinDay(new Date());
  const events = [...upcomingAnniversaries(data.employment, new Date()),
    ...(data.own?.opted_in ? upcomingTeamEvents(data.profiles.map(p => ({ ...p, joined_on: null })), new Date()) : [])]
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!events.length) return null;
  return <aside className="my-3 space-y-2 text-sm" aria-label="Team-Ereignisse diese Woche">
    <p className="font-medium">Im Team diese Woche</p>
    <ul>{events.map(e => <li key={`${e.userId}:${e.kind}:${e.date}`}>
      {e.date === today ? 'Heute' : `${e.date.slice(8)}.${e.date.slice(5, 7)}.`}: {e.name} – {e.kind === 'birthday' ? 'Geburtstag' : `${e.years} Jahre im Team`}
    </li>)}</ul>
    {events.some(e => e.date === today) && <Button variant="outline" size="sm" onClick={() => setCelebration(value => value + 1)}>Mit Konfetti feiern</Button>}
    {celebration > 0 && <ConfettiAnimation key={celebration} size="small" />}
  </aside>;
}
