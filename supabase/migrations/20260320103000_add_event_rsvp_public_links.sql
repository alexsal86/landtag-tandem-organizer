CREATE TABLE IF NOT EXISTS public.event_rsvp_public_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
  public_code TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT event_rsvp_public_links_public_code_key UNIQUE (public_code)
);

COMMENT ON TABLE public.event_rsvp_public_links IS 'Öffentliche RSVP-Links für externe Gäste. Neue Einladungen verwenden public_code statt event_rsvps.token.';
COMMENT ON COLUMN public.event_rsvp_public_links.public_code IS 'Kryptographisch starker, öffentlicher Code für RSVP-Links.';
COMMENT ON COLUMN public.event_rsvp_public_links.revoked_at IS 'Ein gesetzter Wert deaktiviert den öffentlichen Link dauerhaft.';

CREATE INDEX IF NOT EXISTS event_rsvp_public_links_event_rsvp_id_idx
  ON public.event_rsvp_public_links (event_rsvp_id);

CREATE UNIQUE INDEX IF NOT EXISTS event_rsvp_public_links_one_active_link_per_rsvp_idx
  ON public.event_rsvp_public_links (event_rsvp_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.event_rsvp_public_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public RSVP links for their tenant" ON public.event_rsvp_public_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.event_rsvps er
      JOIN public.profiles p ON p.tenant_id = er.tenant_id
      WHERE er.id = event_rsvp_public_links.event_rsvp_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert public RSVP links for their tenant" ON public.event_rsvp_public_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.event_rsvps er
      JOIN public.profiles p ON p.tenant_id = er.tenant_id
      WHERE er.id = event_rsvp_public_links.event_rsvp_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update public RSVP links for their tenant" ON public.event_rsvp_public_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.event_rsvps er
      JOIN public.profiles p ON p.tenant_id = er.tenant_id
      WHERE er.id = event_rsvp_public_links.event_rsvp_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.event_rsvps er
      JOIN public.profiles p ON p.tenant_id = er.tenant_id
      WHERE er.id = event_rsvp_public_links.event_rsvp_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete public RSVP links for their tenant" ON public.event_rsvp_public_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.event_rsvps er
      JOIN public.profiles p ON p.tenant_id = er.tenant_id
      WHERE er.id = event_rsvp_public_links.event_rsvp_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Anon can view RSVP public links by code" ON public.event_rsvp_public_links
  FOR SELECT TO anon USING (
    revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );

CREATE POLICY "Anon can update RSVP public links by code" ON public.event_rsvp_public_links
  FOR UPDATE TO anon USING (
    revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  )
  WITH CHECK (
    revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );
