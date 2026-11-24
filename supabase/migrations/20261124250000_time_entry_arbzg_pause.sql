-- Anteil der Pause, den die Zeiterfassung nach ArbZG automatisch ergänzt hat.
-- Getrennt von pause_minutes, damit der ergänzte Anteil eine Bearbeitung der
-- Notizen überlebt und in Admin-/Freigabeansichten ausgewiesen werden kann.
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS arbzg_pause_minutes integer NOT NULL DEFAULT 0;

-- Bestehende Notizvermerke ("ArbZG: 15 Min Pause automatisch ergänzt") in die
-- eigene Spalte übernehmen und aus den Notizen entfernen.
UPDATE public.time_entries
SET arbzg_pause_minutes = LEAST(
      COALESCE(pause_minutes, 0),
      (regexp_match(notes, 'ArbZG:\s*([0-9]{1,3})\s+Min Pause automatisch ergänzt'))[1]::integer
    ),
    notes = NULLIF(
      btrim(
        regexp_replace(
          regexp_replace(notes, 'ArbZG:\s*[0-9]{1,3}\s+Min Pause automatisch ergänzt', '', 'g'),
          E'\n[[:space:]]*\n',
          E'\n',
          'g'
        )
      ),
      ''
    )
WHERE notes ~ 'ArbZG:\s*[0-9]{1,3}\s+Min Pause automatisch ergänzt';

ALTER TABLE public.time_entries
  DROP CONSTRAINT IF EXISTS time_entries_arbzg_pause_minutes_range;
ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_arbzg_pause_minutes_range
  CHECK (arbzg_pause_minutes >= 0 AND arbzg_pause_minutes <= COALESCE(pause_minutes, 0));

COMMENT ON COLUMN public.time_entries.arbzg_pause_minutes IS
  'Anteil der Pause in Minuten, den die App nach ArbZG automatisch ergänzt hat (nicht tatsächlich gestempelt).';
