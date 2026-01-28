-- Neue Tabelle für "Meine Arbeit" Benutzereinstellungen
CREATE TABLE public.user_mywork_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_display_mode TEXT NOT NULL DEFAULT 'new' CHECK (badge_display_mode IN ('new', 'total')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_mywork_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own settings"
  ON public.user_mywork_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings"
  ON public.user_mywork_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
  ON public.user_mywork_settings FOR UPDATE
  USING (user_id = auth.uid());

-- Trigger für updated_at
CREATE TRIGGER update_user_mywork_settings_updated_at
  BEFORE UPDATE ON public.user_mywork_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();