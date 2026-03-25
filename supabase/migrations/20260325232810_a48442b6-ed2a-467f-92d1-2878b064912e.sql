-- Phase 3: Qualitätsfelder & Review-Erinnerungen für Dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS open_questions text DEFAULT '',
  ADD COLUMN IF NOT EXISTS positions text DEFAULT '',
  ADD COLUMN IF NOT EXISTS risks_opportunities text DEFAULT '',
  ADD COLUMN IF NOT EXISTS review_interval_days integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS next_review_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_dossiers_next_review
  ON public.dossiers (next_review_at)
  WHERE next_review_at IS NOT NULL;