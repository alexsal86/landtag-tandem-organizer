-- Etappe 2: Kontakte, Dokumente und Fallakten schreiben ihre Themen nur noch
-- über die zentralen Verknüpfungstabellen. Die Textarray-Tags bleiben als
-- historischer Bestand erhalten, werden aber nicht mehr fortgeschrieben.
--
-- Klassifikationen (Kontaktkategorie, Dokumentkategorie, Fallaktentyp, Status,
-- Priorität, Sichtbarkeit) werden nicht verändert.

-- Restbestand aus den bisherigen Tags nachziehen. Idempotent, damit die
-- Migration auch nach einem abgebrochenen Lauf erneut ausgeführt werden kann.
INSERT INTO public.contact_topics (tenant_id, contact_id, topic_id)
SELECT c.tenant_id, c.id, coalesce(t.merged_into, t.id)
FROM public.contacts c
CROSS JOIN LATERAL unnest(coalesce(c.tags, '{}')) AS u(tag)
JOIN public.topics t
  ON t.tenant_id = c.tenant_id
 AND lower(t.label) = lower(regexp_replace(btrim(u.tag), '[[:space:]]+', ' ', 'g'))
WHERE c.tenant_id IS NOT NULL
  AND u.tag IS NOT NULL
  AND length(regexp_replace(btrim(u.tag), '[[:space:]]+', ' ', 'g')) BETWEEN 2 AND 40
ON CONFLICT (contact_id, topic_id) DO NOTHING;

INSERT INTO public.case_file_topics (tenant_id, case_file_id, topic_id)
SELECT cf.tenant_id, cf.id, coalesce(t.merged_into, t.id)
FROM public.case_files cf
CROSS JOIN LATERAL unnest(coalesce(cf.tags, '{}')) AS u(tag)
JOIN public.topics t
  ON t.tenant_id = cf.tenant_id
 AND lower(t.label) = lower(regexp_replace(btrim(u.tag), '[[:space:]]+', ' ', 'g'))
WHERE cf.tenant_id IS NOT NULL
  AND u.tag IS NOT NULL
  AND length(regexp_replace(btrim(u.tag), '[[:space:]]+', ' ', 'g')) BETWEEN 2 AND 40
ON CONFLICT (case_file_id, topic_id) DO NOTHING;

-- documents.tags enthält zusätzlich technische Werte (email, file, knowledge:<id>).
INSERT INTO public.document_topics (tenant_id, document_id, topic_id)
SELECT d.tenant_id, d.id, coalesce(t.merged_into, t.id)
FROM public.documents d
CROSS JOIN LATERAL unnest(coalesce(d.tags, '{}')) AS u(tag)
JOIN public.topics t
  ON t.tenant_id = d.tenant_id
 AND lower(t.label) = lower(regexp_replace(btrim(u.tag), '[[:space:]]+', ' ', 'g'))
WHERE d.tenant_id IS NOT NULL
  AND u.tag IS NOT NULL
  AND length(regexp_replace(btrim(u.tag), '[[:space:]]+', ' ', 'g')) BETWEEN 2 AND 40
  AND lower(regexp_replace(btrim(u.tag), '[[:space:]]+', ' ', 'g')) NOT IN ('email', 'file')
  AND lower(regexp_replace(btrim(u.tag), '[[:space:]]+', ' ', 'g')) NOT LIKE 'knowledge:%'
ON CONFLICT (document_id, topic_id) DO NOTHING;

-- Ab hier sind die Junctions der einzige Schreibpfad. Der Trigger würde bei
-- künftigen tags-Updates sonst wieder Themen anlegen oder entfernen. Die alte
-- Organisations-Tag-Vererbung schreibt ebenfalls nur noch in tags und wird
-- deshalb mit abgeschaltet; geerbte Themen liest die UI aus contact_topics.
DROP TRIGGER IF EXISTS sync_tags_to_topics ON public.contacts;
DROP TRIGGER IF EXISTS sync_tags_to_topics ON public.documents;
DROP TRIGGER IF EXISTS sync_tags_to_topics ON public.case_files;
DROP FUNCTION IF EXISTS public.sync_tags_to_topics();
DROP TRIGGER IF EXISTS trigger_inherit_organization_tags ON public.contacts;
DROP FUNCTION IF EXISTS public.inherit_organization_tags();

-- Die Zuordnung zur Organisation bleibt bestehen, kopiert aber keine Tags mehr
-- in den Personen-Datensatz.
CREATE OR REPLACE FUNCTION public.assign_contact_to_organization(contact_id uuid, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.contacts
  SET organization_id = org_id,
      updated_at = now()
  WHERE id = contact_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
