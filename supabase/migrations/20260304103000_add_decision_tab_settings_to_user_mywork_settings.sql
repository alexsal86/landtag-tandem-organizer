ALTER TABLE public.user_mywork_settings
  ADD COLUMN IF NOT EXISTS decision_tabs_order JSONB NOT NULL DEFAULT '["for-me", "answered", "my-decisions", "public"]'::jsonb,
  ADD COLUMN IF NOT EXISTS decision_tabs_hidden JSONB NOT NULL DEFAULT '[]'::jsonb;
