-- Tabelle für Notiz-Freigaben
CREATE TABLE public.quick_note_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.quick_notes(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL,
  shared_by_user_id UUID NOT NULL,
  permission_type TEXT NOT NULL DEFAULT 'view' CHECK (permission_type IN ('view', 'edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(note_id, shared_with_user_id)
);

-- RLS aktivieren
ALTER TABLE public.quick_note_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Eigentümer der Notiz kann Freigaben verwalten
CREATE POLICY "Note owners can manage shares"
  ON public.quick_note_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_notes 
      WHERE id = note_id AND user_id = auth.uid()
    )
  );

-- Policy: Empfänger können ihre Freigaben sehen
CREATE POLICY "Recipients can view their shares"
  ON public.quick_note_shares FOR SELECT
  USING (shared_with_user_id = auth.uid());

-- Bestehende SELECT Policy für quick_notes erweitern (neue Policy erstellen)
CREATE POLICY "Users can view shared notes"
  ON public.quick_notes FOR SELECT
  USING (
    id IN (
      SELECT note_id FROM public.quick_note_shares 
      WHERE shared_with_user_id = auth.uid()
    )
  );

-- Index für Performance
CREATE INDEX idx_quick_note_shares_note_id ON public.quick_note_shares(note_id);
CREATE INDEX idx_quick_note_shares_shared_with ON public.quick_note_shares(shared_with_user_id);