-- Gäste gehören zu ihrem Termin: Fremdschlüssel mit ON DELETE CASCADE, damit
-- beim Löschen eines Termins keine Waisen zurückbleiben. Vorhandene Waisen
-- werden nicht verworfen, sondern in den Audit-Trail gesichert.

-- 1) Bestehende Waisen (Gast ohne Termin) archivieren und entfernen.
DO $$
DECLARE
  v_archived integer := 0;
  v_removed integer := 0;
BEGIN
  WITH orphans AS (
    SELECT g.id,
           g.appointment_id,
           g.tenant_id,
           g.name,
           g.email,
           g.status,
           g.invited_at,
           g.responded_at,
           g.response_note,
           g.created_at
    FROM public.appointment_guests g
    WHERE NOT EXISTS (
      SELECT 1 FROM public.appointments a WHERE a.id = g.appointment_id
    )
  ), archived AS (
    INSERT INTO public.audit_log_entries (tenant_id, user_id, payload)
    SELECT o.tenant_id,
           NULL,
           jsonb_build_object(
             'action', 'appointment_guest.orphaned',
             'archived_at', now(),
             'guest', to_jsonb(o)
           )
    FROM orphans o
    RETURNING 1
  )
  SELECT count(*) INTO v_archived FROM archived;

  -- Der Antworttoken der Waisen wird bewusst nicht mitarchiviert: er gehört zu
  -- einem nicht mehr existierenden Termin und wäre nur noch ein toter Link.
  DELETE FROM public.appointment_guests g
  WHERE NOT EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.id = g.appointment_id
  );
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  IF v_archived > 0 OR v_removed > 0 THEN
    RAISE NOTICE 'appointment_guests: % Waisen im Audit-Trail gesichert, % entfernt', v_archived, v_removed;
  END IF;
END $$;

-- 2) Index auf dem Fremdschlüssel, damit das Cascade-Löschen nicht seq-scant.
CREATE INDEX IF NOT EXISTS idx_appointment_guests_appointment_id
  ON public.appointment_guests (appointment_id);

-- 3) Fremdschlüssel setzen (idempotent, falls bereits ein FK auf der Spalte steht).
DO $$
DECLARE
  v_column smallint;
BEGIN
  SELECT attnum INTO v_column
  FROM pg_attribute
  WHERE attrelid = 'public.appointment_guests'::regclass
    AND attname = 'appointment_id'
    AND NOT attisdropped;

  IF v_column IS NULL THEN
    RAISE EXCEPTION 'Spalte appointment_guests.appointment_id fehlt';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointment_guests'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[v_column]
  ) THEN
    ALTER TABLE public.appointment_guests
      ADD CONSTRAINT appointment_guests_appointment_id_fkey
      FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;
  END IF;
END $$;
