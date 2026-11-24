import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { elapsedSeconds, formatElapsed } from "../agenda-editor/agendaElapsed";
import type { AgendaItem } from "../types";

interface UseAgendaTimerArgs {
  meetingId?: string | null;
  items: AgendaItem[];
  /** Schlüssel des aktuell laufenden Punktes (null = kein Punkt aktiv). */
  currentKey?: string | null;
  /** Ist die Besprechung live? */
  active: boolean;
}

/**
 * Erfasst die Ist-Zeit je Tagesordnungspunkt.
 *
 * Der Browser nennt der Datenbank nur, welcher Punkt läuft. Sie schließt alle
 * anderen laufenden Punkte der Sitzung ab, rechnet die Zeit aus dem dort
 * gespeicherten Start und setzt den neuen Start – in einem Schritt, ohne
 * Zeitstempel-Vergleich im Client. Dadurch gehen beim Wechsel keine Minuten
 * verloren, und ein liegengebliebener Timer wird beim nächsten Aufruf
 * mitgeschlossen statt für immer auf "läuft" zu stehen.
 */
export function useAgendaTimer({ meetingId, items, currentKey, active }: UseAgendaTimerArgs) {
  const [now, setNow] = useState(() => Date.now());
  const [running, setRunning] = useState<{ itemId: string; startedAt: string } | null>(null);

  const currentItemId = useMemo(() => {
    if (!currentKey) return null;
    const item = items.find(
      (entry) => (entry.id && entry.id === currentKey) || (entry.localKey && entry.localKey === currentKey),
    );
    return item?.id ?? null;
  }, [currentKey, items]);

  const sync = useCallback(
    async (itemId: string | null): Promise<string | null> => {
      if (!meetingId) return null;
      const { data, error } = await supabase.rpc("sync_jour_fixe_agenda_timer", {
        _meeting_id: meetingId,
        _item_id: itemId,
      });
      if (error) {
        debugConsole.error("Agenda-Timer konnte nicht gebucht werden:", error);
        return null;
      }
      const payload = data as unknown as { started_at?: string | null } | null;
      return payload?.started_at ?? null;
    },
    [meetingId],
  );

  // Eine bereits laufende Uhr (z. B. nach Neuladen) übernehmen.
  const adoptedRef = useRef(false);
  useEffect(() => {
    if (adoptedRef.current) return;
    adoptedRef.current = true;
    const entry = items.find((item) => item.id && item.timer_started_at);
    if (entry?.id && entry.timer_started_at) {
      setRunning({ itemId: entry.id, startedAt: entry.timer_started_at });
    }
  }, [items]);

  // Punktwechsel: die Datenbank schließt den alten Punkt und startet den neuen.
  const wasActive = useRef(false);
  useEffect(() => {
    if (!meetingId) return;

    if (!active) {
      setRunning(null);
      if (wasActive.current) void sync(null);
      wasActive.current = false;
      return;
    }

    wasActive.current = true;
    let cancelled = false;
    void (async () => {
      const startedAt = await sync(currentItemId);
      if (cancelled) return;
      setRunning(currentItemId && startedAt ? { itemId: currentItemId, startedAt } : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, meetingId, currentItemId, sync]);

  // Beim Verlassen der Sitzung laufende Zeit sichern.
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    if (!meetingId) return;
    return () => {
      if (activeRef.current) void sync(null);
    };
  }, [meetingId, sync]);

  // Anzeige jede Sekunde aktualisieren, solange ein Punkt läuft.
  useEffect(() => {
    if (!active || !running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active, running]);

  return {
    runningItemId: running?.itemId ?? null,
    elapsedSeconds: running ? elapsedSeconds(running.startedAt, now) : 0,
    elapsedLabel: running ? formatElapsed(elapsedSeconds(running.startedAt, now)) : null,
  };
}
