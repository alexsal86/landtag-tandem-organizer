-- Add organization support to contacts system
-- First, add new fields to the existing contacts table for organization support

-- Add organization type field to distinguish between person and organization contacts
ALTER TABLE public.contacts 
ADD COLUMN contact_type text DEFAULT 'person' CHECK (contact_type IN ('person', 'organization'));

-- Add comprehensive organization fields
ALTER TABLE public.contacts 
ADD COLUMN organization_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
ADD COLUMN legal_form text,
ADD COLUMN tax_number text,
ADD COLUMN vat_number text,
ADD COLUMN commercial_register_number text,
ADD COLUMN founding_date date,
ADD COLUMN industry text,
ADD COLUMN company_size text,
ADD COLUMN annual_revenue text,
ADD COLUMN employees_count integer,
ADD COLUMN business_description text,
ADD COLUMN main_contact_person text,
ADD COLUMN billing_address text,
ADD COLUMN shipping_address text,
ADD COLUMN bank_name text,
ADD COLUMN bank_account_number text,
ADD COLUMN bank_routing_number text,
ADD COLUMN iban text,
ADD COLUMN bic_swift text,
ADD COLUMN payment_terms text,
ADD COLUMN credit_limit numeric(10,2),
ADD COLUMN customer_number text,
ADD COLUMN supplier_number text,
ADD COLUMN parent_company text,
ADD COLUMN subsidiaries text[],
ADD COLUMN certifications text[],
ADD COLUMN specializations text[],
ADD COLUMN service_areas text[],
ADD COLUMN established_year integer,
ADD COLUMN rating text,
ADD COLUMN compliance_notes text,
ADD COLUMN partnership_level text,
ADD COLUMN contract_type text,
ADD COLUMN contract_start_date date,
ADD COLUMN contract_end_date date,
ADD COLUMN key_contacts text[],
ADD COLUMN social_media_accounts jsonb,
ADD COLUMN trade_associations text[],
ADD COLUMN awards_recognitions text[],
ADD COLUMN sustainability_practices text,
ADD COLUMN diversity_certifications text[],
ADD COLUMN accessibility_features text[],
ADD COLUMN languages_supported text[],
ADD COLUMN time_zone text,
ADD COLUMN preferred_communication_method text,
ADD COLUMN meeting_preferences text,
ADD COLUMN data_protection_notes text,
ADD COLUMN gdpr_consent_date date,
ADD COLUMN marketing_consent boolean DEFAULT false,
ADD COLUMN newsletter_subscription boolean DEFAULT false,
ADD COLUMN tags text[];

-- Add indexes for better performance
CREATE INDEX idx_contacts_contact_type ON public.contacts(contact_type);
CREATE INDEX idx_contacts_organization_id ON public.contacts(organization_id);
CREATE INDEX idx_contacts_industry ON public.contacts(industry);
CREATE INDEX idx_contacts_company_size ON public.contacts(company_size);
CREATE INDEX idx_contacts_tags ON public.contacts USING GIN(tags);

-- Add constraint to ensure organization references are to organization-type contacts
ALTER TABLE public.contacts 
ADD CONSTRAINT check_organization_reference 
CHECK (
  organization_id IS NULL OR 
  (organization_id IN (SELECT id FROM public.contacts WHERE contact_type = 'organization'))
);

-- Create a function to validate organization references
CREATE OR REPLACE FUNCTION public.validate_organization_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    -- Check if the referenced contact is an organization
    IF NOT EXISTS (
      SELECT 1 FROM public.contacts 
      WHERE id = NEW.organization_id 
      AND contact_type = 'organization'
    ) THEN
      RAISE EXCEPTION 'organization_id must reference a contact with contact_type = organization';
    END IF;
  END IF;
  
  -- Prevent self-reference
  IF NEW.organization_id = NEW.id THEN
    RAISE EXCEPTION 'A contact cannot be assigned to itself as organization';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate organization references
CREATE TRIGGER validate_organization_reference_trigger
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_organization_reference();

-- Update existing contacts to have default values for new fields
UPDATE public.contacts 
SET contact_type = 'person' 
WHERE contact_type IS NULL;