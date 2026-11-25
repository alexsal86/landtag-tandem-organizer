-- Der Briefstatus ist seit 20261125130000 nur noch als Wertemenge geprüft.
-- Ein CHECK-Constraint kennt keine Kanten: `draft` → `sent` blieb damit direkt
-- schreibbar, obwohl der Editor den Freigabe-Loop erzwingt. Diese Migration
-- legt die erlaubten Wechsel als Tabelle an und prüft sie per Trigger.
--
-- Quelle der Kanten ist ALLOWED_TRANSITIONS in
-- src/components/letters/types.ts. `scripts/build-state-artifact.mjs` gleicht
-- Seed und TS-Matrix gegeneinander ab; eine einseitige Änderung lässt
-- `check:state-artifact` fehlschlagen.
--
-- Geklärter Bestand zu `archived`: Die Archivierung setzt seit dem
-- Edge-Function-Pfad `sent` plus archived_at/archived_document_id, nicht
-- `archived`. Der Wert bleibt als historischer Endzustand in der Wertemenge,
-- hat aber bewusst keine eingehende Kante. Alte Zeilen mit `archived` sind
-- damit unveränderlich; ein Wiederöffnen müsste als eigene Kante beschlossen
-- werden.

CREATE TABLE IF NOT EXISTS public.letter_status_transitions (
  from_status text NOT NULL,
  to_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_status, to_status),
  -- Dieselbe geschlossene Wertemenge wie letters_status_check. Beide Regeln
  -- müssen zusammen geändert werden; die Kante selbst steht nur hier.
  CONSTRAINT letter_status_transitions_values_check CHECK (
    from_status IN ('draft', 'review', 'pending_approval', 'approved', 'revision_requested', 'sent', 'archived')
    AND to_status IN ('draft', 'review', 'pending_approval', 'approved', 'revision_requested', 'sent', 'archived')
  ),
  CONSTRAINT letter_status_transitions_no_self_check CHECK (from_status <> to_status)
);

COMMENT ON TABLE public.letter_status_transitions IS
  'Erlaubte Briefstatus-Wechsel; Quelle ist ALLOWED_TRANSITIONS im Client, geprüft durch enforce_letter_status_transition.';

-- Kanonische Kanten aus ALLOWED_TRANSITIONS (Stand 20261125).
INSERT INTO public.letter_status_transitions (from_status, to_status) VALUES
  ('draft', 'review'),
  ('draft', 'pending_approval'),
  ('review', 'pending_approval'),
  ('review', 'draft'),
  ('pending_approval', 'approved'),
  ('pending_approval', 'revision_requested'),
  ('revision_requested', 'draft'),
  ('approved', 'sent'),
  ('approved', 'pending_approval')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Die Matrix ist eine Fachregel, keine administrierbare Liste: lesbar für
-- angemeldete Nutzer, schreibbar nur über Migrationen und service_role.
ALTER TABLE public.letter_status_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS letter_status_transitions_select ON public.letter_status_transitions;
CREATE POLICY letter_status_transitions_select ON public.letter_status_transitions
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.letter_status_transitions TO authenticated;
REVOKE ALL ON public.letter_status_transitions FROM anon;

CREATE OR REPLACE FUNCTION public.enforce_letter_status_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS NULL THEN
    RAISE EXCEPTION 'Briefstatus fehlt' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.letter_status_transitions
    WHERE from_status = OLD.status AND to_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'Unzulässiger Briefstatuswechsel: % -> %', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END $$;

-- Wie enforce_task_status: Triggerfunktionen laufen unabhängig von
-- EXECUTE-Rechten; der Entzug verhindert nur den Aufruf als RPC.
REVOKE ALL ON FUNCTION public.enforce_letter_status_transition() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_letter_status_transition ON public.letters;
CREATE TRIGGER enforce_letter_status_transition
BEFORE UPDATE OF status ON public.letters
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.enforce_letter_status_transition();

-- Grenze dieser Migration: Neuanlagen prüft weiterhin nur letters_status_check
-- (Wertemenge, keine Kante). Ein INSERT direkt in einen Endzustand bleibt damit
-- möglich und wäre eine eigene Regel. Bestehende Zeilen werden nicht umgeschrieben;
-- der Trigger gilt für neue Änderungen, ein Verstoß im Altbestand blockiert nur
-- dessen nächsten Statuswechsel.
