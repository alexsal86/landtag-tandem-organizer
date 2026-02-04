-- Celebration animations table
CREATE TABLE IF NOT EXISTS celebration_animations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'builtin',
  animation_key TEXT NOT NULL UNIQUE,
  custom_svg TEXT,
  custom_gif_url TEXT,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert predefined animations
INSERT INTO celebration_animations (name, type, animation_key, order_index) VALUES
  ('Einhorn', 'builtin', 'unicorn', 0),
  ('Konfetti', 'builtin', 'confetti', 1),
  ('Feuerwerk', 'builtin', 'fireworks', 2),
  ('Sterne', 'builtin', 'stars', 3),
  ('Daumen hoch', 'builtin', 'thumbsup', 4)
ON CONFLICT (animation_key) DO NOTHING;

-- Celebration settings table (per-user settings)
CREATE TABLE IF NOT EXISTS celebration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  mode TEXT DEFAULT 'random' CHECK (mode IN ('random', 'sequential', 'specific')),
  selected_animation TEXT DEFAULT 'unicorn',
  frequency TEXT DEFAULT 'always' CHECK (frequency IN ('always', 'sometimes', 'rarely')),
  speed TEXT DEFAULT 'normal' CHECK (speed IN ('slow', 'normal', 'fast')),
  size TEXT DEFAULT 'medium' CHECK (size IN ('small', 'medium', 'large')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE celebration_animations ENABLE ROW LEVEL SECURITY;
ALTER TABLE celebration_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for celebration_animations (public read, admin write)
CREATE POLICY "Anyone can read celebration animations" 
  ON celebration_animations FOR SELECT 
  USING (true);

-- RLS policies for celebration_settings (user-specific)
CREATE POLICY "Users can read their own celebration settings" 
  ON celebration_settings FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own celebration settings" 
  ON celebration_settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own celebration settings" 
  ON celebration_settings FOR UPDATE 
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_celebration_settings_updated_at
  BEFORE UPDATE ON celebration_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();