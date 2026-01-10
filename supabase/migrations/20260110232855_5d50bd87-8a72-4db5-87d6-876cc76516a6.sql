-- 1. Tabelle für globale Notiz-Freigaben (alle Notizen eines Users für einen anderen User)
CREATE TABLE public.quick_note_global_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shared_with_user_id UUID NOT NULL,
  permission_type TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_global_share UNIQUE (user_id, shared_with_user_id),
  CONSTRAINT check_permission_type CHECK (permission_type IN ('view', 'edit'))
);

-- RLS für quick_note_global_shares
ALTER TABLE public.quick_note_global_shares ENABLE ROW LEVEL SECURITY;

-- Eigentümer kann eigene globale Freigaben verwalten
CREATE POLICY "Users can manage their own global shares" 
ON public.quick_note_global_shares 
FOR ALL USING (user_id = auth.uid());

-- User können sehen, wer mit ihnen geteilt hat
CREATE POLICY "Users can see global shares with them" 
ON public.quick_note_global_shares 
FOR SELECT USING (shared_with_user_id = auth.uid());

-- 2. Spalten für Soft-Delete (Papierkorb) hinzufügen
ALTER TABLE public.quick_notes 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS permanent_delete_at TIMESTAMP WITH TIME ZONE;

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_quick_notes_deleted_at ON public.quick_notes(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quick_note_global_shares_user ON public.quick_note_global_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_note_global_shares_shared_with ON public.quick_note_global_shares(shared_with_user_id);

-- 3. Security Definer Function für globale Freigaben erweitern
CREATE OR REPLACE FUNCTION public.get_globally_shared_user_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM quick_note_global_shares
  WHERE shared_with_user_id = _user_id
$$;

-- 4. Policy für quick_notes aktualisieren: Auch global geteilte Notizen sichtbar
DROP POLICY IF EXISTS "Users can view shared notes" ON public.quick_notes;

CREATE POLICY "Users can view shared notes" ON public.quick_notes
FOR SELECT USING (
  id IN (SELECT public.get_shared_note_ids(auth.uid()))
  OR user_id IN (SELECT public.get_globally_shared_user_ids(auth.uid()))
);