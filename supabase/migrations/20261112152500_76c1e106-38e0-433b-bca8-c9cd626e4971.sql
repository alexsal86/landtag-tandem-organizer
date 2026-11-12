ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS legal_basis text,
  ADD COLUMN IF NOT EXISTS source_origin text,
  ADD COLUMN IF NOT EXISTS processing_purpose text,
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz,
  ADD COLUMN IF NOT EXISTS retention_review_date date,
  ADD COLUMN IF NOT EXISTS retention_status text NOT NULL DEFAULT 'active';

CREATE OR REPLACE FUNCTION public.contacts_default_retention()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.legal_basis IS NULL THEN
    NEW.legal_basis := CASE WHEN NEW.category = 'citizen' THEN 'mandate_public_interest' ELSE 'legitimate_interest' END;
  END IF;
  IF NEW.retention_review_date IS NULL THEN
    NEW.retention_review_date := CASE WHEN NEW.category = 'citizen'
      THEN (COALESCE(NEW.created_at, now()) + interval '24 months')::date
      ELSE DATE '2031-03-31' END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contacts_default_retention ON public.contacts;
CREATE TRIGGER trg_contacts_default_retention BEFORE INSERT ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.contacts_default_retention();

UPDATE public.contacts SET
  legal_basis = COALESCE(legal_basis, CASE WHEN category = 'citizen' THEN 'mandate_public_interest' ELSE 'legitimate_interest' END),
  retention_review_date = COALESCE(retention_review_date, CASE WHEN category = 'citizen'
      THEN (created_at + interval '24 months')::date ELSE DATE '2031-03-31' END)
WHERE legal_basis IS NULL OR retention_review_date IS NULL;