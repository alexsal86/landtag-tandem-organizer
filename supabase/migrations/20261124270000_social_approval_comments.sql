-- Redaktion: Änderungswünsche brauchen eine Tabelle.
--
-- request_social_post_changes aus 20261124200000_editorial_approval_workflow.sql schreibt jeden
-- Änderungswunsch nach public.social_approval_comments, und die Redaktion liest den Verlauf dort
-- (src/features/redaktion/hooks/useApprovalComments.ts). Die Tabelle existierte in der laufenden
-- Datenbank, aber keine Migration hat sie angelegt – auf einer frisch aufgesetzten Datenbank
-- scheiterte die Funktion deshalb mit „relation does not exist“.
--
-- Die Tabelle folgt exakt dem laufenden Schema aus src/integrations/supabase/types.ts –
-- einschließlich seiner einzigen Beziehung: social_approval_comments_content_item_id_fkey.
-- tenant_id und author_id tragen dort bewusst keinen Fremdschlüssel; sie werden deshalb auch hier
-- ohne angelegt, damit frische und bestehende Installationen dasselbe Schema haben. Die
-- Mandanten- und Autorenbindung sichern stattdessen die Policies unten (Mitgliedschaft, eigener
-- Tenant, eigenes Profil) und request_social_post_changes, das als Eigentümer schreibt. Löscht
-- jemand einen Beitrag, räumt der vorhandene Fremdschlüssel den Verlauf mit ab.
-- Bestehende Installationen bleiben unberührt: CREATE TABLE/INDEX IF NOT EXISTS sind dort ein
-- No-op, und die Policies werden unter ihren Namen ersetzt statt gedoppelt. Es werden keine
-- Daten geschrieben, geändert oder gelöscht.

CREATE TABLE IF NOT EXISTS public.social_approval_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  content_item_id uuid NOT NULL REFERENCES public.social_content_items(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  comment text NOT NULL,
  is_change_request boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Der Verlauf wird chronologisch pro Beitrag geladen; die Tenant-Spalte bleibt für RLS-Abfragen.
CREATE INDEX IF NOT EXISTS idx_social_approval_comments_item
  ON public.social_approval_comments (content_item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_social_approval_comments_tenant
  ON public.social_approval_comments (tenant_id);

ALTER TABLE public.social_approval_comments ENABLE ROW LEVEL SECURITY;

-- Kommentare sind Freigabe-Protokoll: anlegen und lesen, nicht nachträglich umschreiben.
-- (Der Änderungswunsch selbst läuft ohnehin nur über request_social_post_changes.)
REVOKE ALL ON public.social_approval_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.social_approval_comments TO authenticated;
GRANT ALL ON public.social_approval_comments TO service_role;

DROP POLICY IF EXISTS "social_approval_comments_select_scoped" ON public.social_approval_comments;
CREATE POLICY "social_approval_comments_select_scoped"
ON public.social_approval_comments
FOR SELECT
TO authenticated
USING (public.user_has_tenant_access(auth.uid(), tenant_id));

-- Anlegen darf jede Rolle der Redaktion, aber nur im eigenen Tenant, nur zum eigenen Beitrag
-- und nur unter dem eigenen Namen – sonst ließen sich Kommentare im Namen anderer platzieren.
DROP POLICY IF EXISTS "social_approval_comments_insert_scoped" ON public.social_approval_comments;
CREATE POLICY "social_approval_comments_insert_scoped"
ON public.social_approval_comments
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_active_tenant_role(
    auth.uid(), tenant_id, ARRAY['mitarbeiter', 'praktikant', 'bueroleitung', 'abgeordneter']
  )
  AND author_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  AND EXISTS (
    SELECT 1
      FROM public.social_content_items i
     WHERE i.id = social_approval_comments.content_item_id
       AND i.tenant_id = social_approval_comments.tenant_id
  )
);
