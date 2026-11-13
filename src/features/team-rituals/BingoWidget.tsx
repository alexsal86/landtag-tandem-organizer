import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfettiAnimation } from '@/components/celebrations/ConfettiAnimation';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/utils/storage';
import { supabase } from '@/integrations/supabase/client';
import { useTeamRituals, record, text, list } from './data';
import { useRitualAction } from './actions';
import { berlinWeek } from './logic';
import { bingoBoard, checkBingo, readBingoState, validBingoFields } from './bingo';

/** @owner team-platform @secondary-owner team-office @feature team-rituals */
function useBingoConfig() {
  const rituals = useTeamRituals();
  const config = useQuery({
    queryKey: ['team-bingo', rituals.tenantId, rituals.userId],
    enabled: !!rituals.tenantId && !!rituals.userId && (!!rituals.data?.enabled || !!rituals.data?.admin),
    queryFn: async () => {
      const result = await supabase.rpc('team_bingo_config', { p_tenant: rituals.tenantId! });
      if (result.error) throw result.error;
      const fields = list(record(result.data).fields).map(text);
      if (!validBingoFields(fields)) throw new Error('Ungültige Bingo-Felder');
      return fields;
    },
  });
  return { ...rituals, fields: config.data, configError: config.error };
}
export function BingoWidget() {
  const { data, error, fields, configError, tenantId, userId } = useBingoConfig();
  return <Card className="h-full overflow-auto"><CardHeader><CardTitle>Mandats-Bingo</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm text-muted-foreground">Freiwilliger Bürospaß: Markiere drei Felder in einer Reihe, Spalte oder Diagonale. Deine Auswahl bleibt nur in diesem Browser – ohne Rangliste.</p>
    {error || configError ? <p role="alert">Bingo konnte nicht geladen werden.</p>
      : !data ? <p>Bingo wird geladen …</p>
      : !data.enabled ? <p>Team-Rituale sind für dieses Büro ausgeschaltet.</p>
      : fields && tenantId && userId ? <LocalBingo key={`${tenantId}:${userId}:${berlinWeek(new Date())}:${JSON.stringify(fields)}`} fields={fields} tenantId={tenantId} userId={userId} /> : <p>Felder werden geladen …</p>}
    <Button asChild variant="link"><Link to="/employee?tab=rituals">Team-Rituale verwalten</Link></Button>
  </CardContent></Card>;
}
function LocalBingo({ fields, tenantId, userId }: { fields: string[]; tenantId: string; userId: string }) {
  const storageKey = `team-bingo:${userId}:${tenantId}`;
  const scope = `${berlinWeek(new Date())}:${JSON.stringify(fields)}`;
  const [state, setState] = useState(() => readBingoState(safeGetItem(storageKey), scope));
  const [celebration, setCelebration] = useState(0);
  const board = bingoBoard(fields, `${userId}:${tenantId}:${scope}`);
  useEffect(() => {
    if (state.started) safeSetItem(storageKey, JSON.stringify({ ...state, scope }));
    else safeRemoveItem(storageKey);
  }, [state, storageKey, scope]);
  if (!state.started) return <Button onClick={() => setState({ started: true, selected: [] })}>Bingo freiwillig starten</Button>;
  function toggle(index: number) {
    const selected = state.selected.includes(index) ? state.selected.filter(i => i !== index) : [...state.selected, index];
    if (!checkBingo(state.selected) && checkBingo(selected)) setCelebration(value => value + 1);
    setState({ started: true, selected });
  }
  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Bingo-Felder">
      {board.map((field, index) => <Button key={field} aria-pressed={state.selected.includes(index)} variant={state.selected.includes(index) ? 'default' : 'outline'} className="h-auto min-h-24 whitespace-normal break-words px-2 py-3 text-xs sm:text-sm" onClick={() => toggle(index)}>{field}</Button>)}
    </div>
    {checkBingo(state.selected) && <p className="font-semibold" role="status">Bingo! Zeit für eine kleine gemeinsame Freude.</p>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setState({ started: true, selected: [] })}>Felder zurücksetzen</Button><Button variant="ghost" onClick={() => setState({ started: false, selected: [] })}>Teilnahme beenden & Auswahl löschen</Button></div>
    {celebration > 0 && <ConfettiAnimation key={celebration} size="small" />}
  </div>;
}
export function BingoSettings() {
  const { data, tenantId, fields, configError } = useBingoConfig();
  const { busy, run } = useRitualAction(tenantId);
  if (!data?.admin || !tenantId) return null;
  if (configError) return <p role="alert">Bingo-Konfiguration konnte nicht geladen werden.</p>;
  if (!fields) return null;
  return <BingoFieldsForm key={`${tenantId}:${JSON.stringify(fields)}`} fields={fields} busy={busy} onSave={value => run(() => supabase.rpc('save_team_bingo_config', { p_tenant: tenantId, p_fields: value }))} />;
}
function BingoFieldsForm({ fields, busy, onSave }: { fields: string[]; busy: boolean; onSave: (fields: string[]) => Promise<boolean> }) {
  const [value, setValue] = useState(fields.join('\n'));
  const updated = value.split('\n').map(field => field.trim()).filter(Boolean);
  return <Card><CardHeader><CardTitle>Bingo-Felder verwalten</CardTitle></CardHeader><CardContent>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void onSave(updated); }}>
      <label className="block">Ein Feld pro Zeile<Textarea rows={12} value={value} onChange={e => setValue(e.target.value)} /></label>
      <p className="text-sm text-muted-foreground">9–40 verschiedene, neutrale Felder mit jeweils höchstens 120 Zeichen. Keine Personen oder Fraktionen bloßstellen. Änderungen beginnen eine neue lokale Runde.</p>
      <Button disabled={busy || !validBingoFields(updated)}>Bingo-Felder speichern</Button>
    </form>
  </CardContent></Card>;
}
