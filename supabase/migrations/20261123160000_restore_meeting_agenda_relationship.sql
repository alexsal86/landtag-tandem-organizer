-- Restore schema metadata without deleting historical orphan agenda rows.
-- NOT VALID still enforces the relationship on new/changed rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f' AND c.conrelid = 'public.meeting_agenda_items'::regclass
      AND c.confrelid = 'public.meetings'::regclass
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = 'public.meeting_agenda_items'::regclass AND attname = 'meeting_id')]::smallint[]
      AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = 'public.meetings'::regclass AND attname = 'id')]::smallint[]
  ) THEN
    ALTER TABLE public.meeting_agenda_items
      ADD CONSTRAINT meeting_agenda_items_meeting_id_fkey
      FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
