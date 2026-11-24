-- Rechnerisch ergänzte Pausen wurden bisher von der Arbeitszeit abgezogen, obwohl
-- sie nie genommen wurden. Die Zeiterfassung speichert ab jetzt nur tatsächlich
-- erfasste Pausen; fehlende Ruhepausen erscheinen als Klärungsbedarf, ohne die
-- geleistete Arbeit zu kürzen.
--
-- Betroffen sind ausschließlich Zeilen mit arbzg_pause_minutes > 0, also nur die
-- von der Automatik ergänzten Pausenanteile. Die tatsächlich erfassten Pausen
-- (pause_minutes abzüglich dieses Anteils) bleiben unverändert, ebenso Einträge
-- ohne automatisch ergänzte Pause.
UPDATE public.time_entries
SET pause_minutes = GREATEST(0, COALESCE(pause_minutes, 0) - arbzg_pause_minutes),
    minutes = CASE
                WHEN started_at IS NOT NULL AND ended_at IS NOT NULL THEN
                  ROUND(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60)
                  - GREATEST(0, COALESCE(pause_minutes, 0) - arbzg_pause_minutes)
                ELSE COALESCE(minutes, 0)
              END,
    arbzg_pause_minutes = 0
WHERE arbzg_pause_minutes > 0;

-- Die Nettozeit wird hier explizit als Ende - Start - korrigierte Pause gesetzt
-- und hängt nicht vom Trigger ensure_net_minutes ab. Ist der Trigger aktiv, schreibt
-- er beim BEFORE UPDATE denselben Wert, die Korrektur ist also wiederholbar.

COMMENT ON COLUMN public.time_entries.arbzg_pause_minutes IS
  'Historische Spalte. Die Zeiterfassung ergänzt keine Pausen mehr rechnerisch und zieht keine vorgeschlagenen Pausen ab.';
