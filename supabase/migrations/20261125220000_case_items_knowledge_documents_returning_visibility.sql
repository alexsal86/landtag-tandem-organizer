-- INSERT ... RETURNING braucht eine zeilenlokale SELECT-Policy.
--
-- Dieselbe Ursache wie bei case_item_interactions (20261125210000): die SELECT-Policy prüft den
-- Zugriff über eine STABLE-Funktion, die die eigene Tabelle anhand der Zeilen-id nachliest. Im
-- Statement-Snapshot eines INSERT ist die neue Zeile noch nicht sichtbar, die Funktion liefert
-- false, und das in App und Selbsttests genutzte `insert(...).select()` scheitert mit
--   42501 new row violates row-level security policy for table "..."
-- obwohl der Insert über die WITH-CHECK-Policy erlaubt ist.
--
-- Betroffen (geprüft in scripts/test-insert-returning-rls.mjs):
--   case_items          "Users can view accessible case items"       -> user_can_access_case_item(auth.uid(), id)
--   knowledge_documents knowledge_legacy_read_boundary (RESTRICTIVE) -> can_access_knowledge_document(id, auth.uid())
--
-- Nicht betroffen, weil die SELECT-Policy dort nur Spalten der neuen Zeile bzw. fremde Tabellen
-- liest: case_files, task_decisions, letters, tasks, appointments, meetings, event_plannings,
-- daily_briefings, appointment_preparations, quick_notes, document_annotations.
--
-- Beide Korrekturen sind zeilenlokal und öffnen nichts zusätzlich: sie erlauben genau die Zeile,
-- die die jeweilige Insert-Policy bereits anlegen durfte (eigener Autor plus aktive
-- Büromitgliedschaft).

-- case_items: zusätzliche permissive SELECT-Policy für den Autor der neuen Zeile.
-- Die bestehende Policy über user_can_access_case_item bleibt unverändert für alle Lesepfade.
DROP POLICY IF EXISTS "Authors can view own case items" ON public.case_items;

CREATE POLICY "Authors can view own case items"
ON public.case_items FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))
);

-- knowledge_documents: hier muss die restrictive Lesegrenze selbst zeilenlokal werden.
-- Restriktive Policies werden mit UND verknüpft, eine zusätzliche permissive Policy würde das
-- RETURNING also nicht retten. Der neue Zweig entspricht exakt dem Autorenzweig von
-- can_access_knowledge_document (created_by = auth.uid() und aktive Mitgliedschaft), sodass
-- veröffentlichte Dokumente, Freigaben und die Bürogrenze unverändert bleiben.
DROP POLICY IF EXISTS knowledge_legacy_read_boundary ON public.knowledge_documents;

CREATE POLICY knowledge_legacy_read_boundary
ON public.knowledge_documents AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_tenant_memberships m
      WHERE m.tenant_id = knowledge_documents.tenant_id
        AND m.user_id = auth.uid()
        AND m.is_active
    )
  )
  OR public.can_access_knowledge_document(id, auth.uid())
);
