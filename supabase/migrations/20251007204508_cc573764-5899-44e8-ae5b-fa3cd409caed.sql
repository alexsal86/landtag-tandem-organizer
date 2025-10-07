-- Erstelle login_customization Tabelle
CREATE TABLE IF NOT EXISTS public.login_customization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Branding
  logo_url TEXT,
  background_image_url TEXT,
  background_position TEXT DEFAULT 'center',
  
  -- Farben (optional override, defaults zu Grünen-CI)
  primary_color TEXT DEFAULT '#57ab27',
  accent_color TEXT DEFAULT '#E6007E',
  
  -- Texte
  tagline TEXT DEFAULT 'Ihre politische Arbeit. Organisiert.',
  welcome_text TEXT DEFAULT 'Willkommen bei LandtagsOS',
  footer_text TEXT DEFAULT '© 2025 LandtagsOS',
  
  -- Funktions-Toggles
  social_login_enabled BOOLEAN DEFAULT false,
  registration_enabled BOOLEAN DEFAULT true,
  password_reset_enabled BOOLEAN DEFAULT true,
  
  -- Unsplash Attribution (falls Unsplash-Bild verwendet)
  background_attribution JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.login_customization ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view login customization"
  ON public.login_customization FOR SELECT
  USING (true);

CREATE POLICY "Admins can update login customization"
  ON public.login_customization FOR UPDATE
  USING (
    tenant_id IN (
      SELECT utm.tenant_id 
      FROM public.user_tenant_memberships utm
      JOIN public.user_roles ur ON ur.user_id = utm.user_id
      WHERE utm.user_id = auth.uid() 
        AND utm.is_active = true
        AND ur.role IN ('abgeordneter', 'bueroleitung')
    )
  );

CREATE POLICY "Admins can insert login customization"
  ON public.login_customization FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT utm.tenant_id 
      FROM public.user_tenant_memberships utm
      JOIN public.user_roles ur ON ur.user_id = utm.user_id
      WHERE utm.user_id = auth.uid() 
        AND utm.is_active = true
        AND ur.role IN ('abgeordneter', 'bueroleitung')
    )
  );

-- Trigger für updated_at
CREATE TRIGGER update_login_customization_updated_at
  BEFORE UPDATE ON public.login_customization
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Default-Einstellungen für bestehende Tenants (mit Karlsruhe-Hintergrundbild)
INSERT INTO public.login_customization (tenant_id, background_image_url)
SELECT id, 'https://images.unsplash.com/photo-1584974292709-5c2f0619971b?w=1920&q=80' 
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;