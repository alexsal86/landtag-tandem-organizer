-- Selbsttest „Aufgaben-Lifecycle · Dokument an Aufgabe hängen und wieder lösen“
-- meldet „Dokumentverknüpfung weicht ab.“
--
-- Der Schritt hängt ein Dokument an die eigene Aufgabe, prüft die Ablage, weist
-- ein Dokument an eine fremde/unbekannte Aufgabe ab und löst die Verknüpfung
-- wieder. Die Abweisung hing bisher allein an den RLS-Policies vom 20260308.
-- Die Tabelle task_documents entstand außerhalb der Migrationen; auf einer
-- Instanz, auf der die späteren Policy-Fassungen fehlen, gelten weiter die
-- permissiven Policies vom 20250812 mit WITH CHECK (true). Der Fremdversuch
-- landet dann in der Tabelle, und der Schritt meldet die Abweichung.
--
-- Diese Migration stellt den Stand der Migrationen wieder her (Policies wie
-- 20260308150147 und 20261112004730) und macht die Abweisung zusätzlich von der
-- Datenbankstruktur abhängig: task_id muss auf eine vorhandene Aufgabe zeigen.
-- NOT VALID prüft nur neue Zeilen; bestehende Verknüpfungen, auch solche auf
-- inzwischen entfernte Aufgaben, bleiben unangetastet.

-- 1) Fremdschlüssel: ein Dokument kann nicht an eine unbekannte Aufgabe zeigen.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.task_documents'::regclass
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) ILIKE '%REFERENCES tasks(id)%'
  ) THEN
    ALTER TABLE public.task_documents
      ADD CONSTRAINT task_documents_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- 2) Policies: permissive Fassungen entfernen, geprüfte Fassung neu setzen.
ALTER TABLE public.task_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All users can view task documents" ON public.task_documents;
DROP POLICY IF EXISTS "All users can create task documents" ON public.task_documents;
DROP POLICY IF EXISTS "All users can delete task documents" ON public.task_documents;
DROP POLICY IF EXISTS "Users can view task documents they have access to" ON public.task_documents;
DROP POLICY IF EXISTS "Authenticated users can create task documents for accessible tasks" ON public.task_documents;
DROP POLICY IF EXISTS "Users can delete their own task documents" ON public.task_documents;
DROP POLICY IF EXISTS "Tenant members can view task documents" ON public.task_documents;

-- Lesen: eigene Dokumente oder Aufgaben des eigenen Büros.
CREATE POLICY "Tenant members can view task documents" ON public.task_documents
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_documents.task_id
      AND t.tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
  )
);

-- Anhängen: nur an Aufgaben, auf die die Person Zugriff hat (eigene, ihr
-- zugewiesene oder im aktiven Büro). Unbekannte und fremde Aufgaben scheitern
-- damit mit 42501, zusätzlich greift der Fremdschlüssel aus Schritt 1 (23503).
CREATE POLICY "Authenticated users can create task documents for accessible tasks" ON public.task_documents
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND (
        t.user_id = auth.uid()
        OR t.assigned_to = auth.uid()::text
        OR t.tenant_id IN (
          SELECT utm.tenant_id FROM public.user_tenant_memberships utm
          WHERE utm.user_id = auth.uid() AND utm.is_active = true
        )
      )
  )
);

-- Lösen: nur an Aufgaben, die der Person gehören oder ihr zugewiesen sind.
CREATE POLICY "Users can delete their own task documents" ON public.task_documents
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid()::text)
  )
);
