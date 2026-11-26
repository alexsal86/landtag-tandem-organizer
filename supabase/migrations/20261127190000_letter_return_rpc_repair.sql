-- Selbsttest „Brief-Lifecycle · Brief mit Begründung aus der Prüfung
-- zurückgeben“ meldet PGRST202:
--   Could not find the function public.return_letter_for_revision(
--   _letter_id, _reason) in the schema cache.
--
-- Der Client ruft den Einstiegspunkt genau mit diesen Argumentnamen auf
-- (src/services/letterWorkflow.ts, src/integrations/supabase/types.ts), die
-- Regeln stehen unverändert in 20261126100000_secure_letter_return.sql. PGRST202
-- heißt: PostgREST findet keine Funktion, deren Name und Argumentnamen zum
-- Aufruf passen – entweder fehlt sie auf der Instanz, trägt sie eine abweichende
-- Signatur, oder der Schema-Cache wurde nach dem Anlegen nicht neu geladen.
--
-- CREATE OR REPLACE FUNCTION kann eine abweichende Parametrisierung nicht
-- ersetzen (42P13). Deshalb wird der Einstiegspunkt zuerst über seine
-- Typsignatur verworfen und anschließend mit dem Rumpf aus 20261126100000 neu
-- angelegt; Verhalten, Prüfungen und Meldungen bleiben damit identisch.
-- Zusätzlich wird die Schreibgrenze erneut zugesichert (Guard-Trigger), die
-- Rückgabekanten der Statusmatrix werden bei Bedarf ergänzt, und am Ende lädt
-- NOTIFY pgrst den Schema-Cache neu. Die Migration ist wiederholbar.

DROP FUNCTION IF EXISTS public.return_letter_for_revision(uuid, text);

CREATE OR REPLACE FUNCTION public.return_letter_for_revision(
  _letter_id uuid,
  _reason text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_letter public.letters;
  v_target text;
  v_reason text;
  v_title text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung fehlt' USING ERRCODE = '42501';
  END IF;

  v_reason := btrim(coalesce(_reason, ''));
  IF v_reason = '' THEN
    RAISE EXCEPTION 'Bitte die Rückgabe begründen' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_letter FROM public.letters WHERE id = _letter_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brief nicht gefunden' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_tenant_member(v_letter.tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Brief' USING ERRCODE = '42501';
  END IF;

  -- Rollenprüfung: nur zugewiesene Prüfer (letter_collaborators) dürfen zurückgeben.
  IF NOT EXISTS (
    SELECT 1 FROM public.letter_collaborators lc
    WHERE lc.letter_id = v_letter.id AND lc.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nur zugewiesene Prüfer dürfen den Brief zurückgeben' USING ERRCODE = '42501';
  END IF;

  v_target := CASE v_letter.status
    WHEN 'review' THEN 'draft'
    WHEN 'pending_approval' THEN 'revision_requested'
    ELSE NULL
  END;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Rückgabe ist aus Status % nicht möglich', v_letter.status USING ERRCODE = '22023';
  END IF;

  -- Der Guard-Trigger lässt genau diesen Rücksprung über diese Funktion zu.
  PERFORM set_config('app.letter_return', 'on', true);

  UPDATE public.letters
     SET status = v_target,
         revision_comment = v_reason,
         revision_requested_at = now(),
         revision_requested_by = auth.uid(),
         updated_at = now()
   WHERE id = v_letter.id;

  -- Begründung gehört in die Benachrichtigung; server-seitig, damit sie nicht
  -- vom Client abhängt.
  IF v_letter.created_by IS NOT NULL AND v_letter.created_by <> auth.uid() THEN
    v_title := coalesce(nullif(btrim(coalesce(v_letter.title, '')), ''), 'Unbenannt');
    PERFORM public.create_notification(
      v_letter.created_by,
      'letter_review_completed',
      'Brief zur Überarbeitung zurückgegeben',
      'Der Brief "' || v_title || '" wurde zurückgegeben. Begründung: ' || v_reason,
      jsonb_build_object('letter_id', v_letter.id, 'letter_title', v_title),
      'high',
      v_letter.tenant_id
    );
  END IF;

  RETURN v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.return_letter_for_revision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_letter_for_revision(uuid, text) TO authenticated;

-- Guard: Rückgabekanten nur über das RPC. Das Merkmal ist transaktionslokal
-- gesetzt und für Clients über PostgREST nicht manipulierbar.
CREATE OR REPLACE FUNCTION public.guard_letter_return_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF OLD.status IN ('review', 'pending_approval')
     AND NEW.status IN ('draft', 'revision_requested')
     AND coalesce(current_setting('app.letter_return', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Rückgabe nur über return_letter_for_revision'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_letter_return_transition() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_letter_return_transition ON public.letters;
CREATE TRIGGER guard_letter_return_transition
BEFORE UPDATE OF status ON public.letters
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.guard_letter_return_transition();

-- Die Statusmatrix kennt die Rückgabekanten bereits; fehlen sie auf einer
-- Instanz, würde der Trigger aus 20261125150000 genau diesen Wechsel abweisen.
DO $$
BEGIN
  IF to_regclass('public.letter_status_transitions') IS NOT NULL THEN
    INSERT INTO public.letter_status_transitions (from_status, to_status) VALUES
      ('review', 'draft'),
      ('pending_approval', 'revision_requested')
    ON CONFLICT (from_status, to_status) DO NOTHING;
  END IF;
END $$;

COMMENT ON FUNCTION public.return_letter_for_revision(uuid, text) IS
  'Gibt einen Brief mit Begründung an den Ersteller zurück; prüft Anmeldung, Mandant, Prüferzuordnung und Ausgangsstatus und ist der einzige Weg für die Rückgabekanten.';

-- Ohne diesen Anstoß bleibt ein schon gelaufener Schema-Cache stehen und die
-- Funktion ist weiter unbekannt, obwohl sie in der Datenbank existiert.
NOTIFY pgrst, 'reload schema';
