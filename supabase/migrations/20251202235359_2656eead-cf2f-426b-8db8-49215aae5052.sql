-- 1. Haupt-Tabelle für FallAkten
CREATE TABLE public.case_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  title text NOT NULL,
  description text,
  case_type text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'active',
  priority text DEFAULT 'medium',
  reference_number text,
  start_date date,
  target_date date,
  tags text[],
  is_private boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Kontakte verknüpfen
CREATE TABLE public.case_file_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role text DEFAULT 'stakeholder',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_file_id, contact_id)
);

-- 3. Dokumente verknüpfen
CREATE TABLE public.case_file_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  relevance text DEFAULT 'supporting',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_file_id, document_id)
);

-- 4. Aufgaben verknüpfen
CREATE TABLE public.case_file_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_file_id, task_id)
);

-- 5. Termine verknüpfen
CREATE TABLE public.case_file_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_file_id, appointment_id)
);

-- 6. Briefe verknüpfen
CREATE TABLE public.case_file_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_file_id, letter_id)
);

-- 7. Notizen zur FallAkte
CREATE TABLE public.case_file_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Timeline/Chronologie
CREATE TABLE public.case_file_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_type text DEFAULT 'note',
  title text NOT NULL,
  description text,
  source_type text,
  source_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS für case_files
ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view case files in their tenant"
ON public.case_files FOR SELECT
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create case files in their tenant"
ON public.case_files FOR INSERT
WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update case files in their tenant"
ON public.case_files FOR UPDATE
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their own case files"
ON public.case_files FOR DELETE
USING (user_id = auth.uid());

-- RLS für case_file_contacts
ALTER TABLE public.case_file_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage case file contacts"
ON public.case_file_contacts FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.case_files cf 
  WHERE cf.id = case_file_contacts.case_file_id 
  AND cf.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
));

-- RLS für case_file_documents
ALTER TABLE public.case_file_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage case file documents"
ON public.case_file_documents FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.case_files cf 
  WHERE cf.id = case_file_documents.case_file_id 
  AND cf.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
));

-- RLS für case_file_tasks
ALTER TABLE public.case_file_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage case file tasks"
ON public.case_file_tasks FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.case_files cf 
  WHERE cf.id = case_file_tasks.case_file_id 
  AND cf.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
));

-- RLS für case_file_appointments
ALTER TABLE public.case_file_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage case file appointments"
ON public.case_file_appointments FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.case_files cf 
  WHERE cf.id = case_file_appointments.case_file_id 
  AND cf.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
));

-- RLS für case_file_letters
ALTER TABLE public.case_file_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage case file letters"
ON public.case_file_letters FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.case_files cf 
  WHERE cf.id = case_file_letters.case_file_id 
  AND cf.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
));

-- RLS für case_file_notes
ALTER TABLE public.case_file_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage case file notes"
ON public.case_file_notes FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.case_files cf 
  WHERE cf.id = case_file_notes.case_file_id 
  AND cf.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
));

-- RLS für case_file_timeline
ALTER TABLE public.case_file_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage case file timeline"
ON public.case_file_timeline FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.case_files cf 
  WHERE cf.id = case_file_timeline.case_file_id 
  AND cf.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
));

-- Trigger für updated_at
CREATE TRIGGER update_case_files_updated_at
BEFORE UPDATE ON public.case_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_case_file_notes_updated_at
BEFORE UPDATE ON public.case_file_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();