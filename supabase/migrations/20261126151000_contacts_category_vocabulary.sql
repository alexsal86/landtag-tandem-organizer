-- Die Kontaktkategorie war zuletzt auf fünf Werte begrenzt
-- (citizen, colleague, lobbyist, media, business). Die Oberfläche kennt und
-- beschriftet jedoch weitere Kategorien (u. a. Organisation, Politik &
-- Verwaltung, NGO, Wissenschaft) in ContactDetailSheet; Schreibvorgänge wie
-- "Kategorie + Schlagworte ändern" scheiterten deshalb mit
--   Code 23514 · contacts_category_check.
-- Der Spalten-CHECK wird auf die tatsächlich verwendete Werteliste erweitert.
-- Die fünf bisherigen Werte bleiben unverändert gültig.

DO $$
DECLARE
  check_constraint record;
BEGIN
  FOR check_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.contacts'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.contacts DROP CONSTRAINT %I', check_constraint.conname);
  END LOOP;
END $$;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_category_check CHECK (
    category IS NULL OR category = ANY (ARRAY[
      'citizen',
      'colleague',
      'business',
      'media',
      'lobbyist',
      'organization',
      'government',
      'ngo',
      'academia',
      'healthcare',
      'legal',
      'other'
    ]::text[])
  ) NOT VALID;

-- NOT VALID wie bei den Statuswerten: die Regel gilt sofort für neue und
-- geänderte Zeilen, bewertet aber keinen historischen Bestand.
