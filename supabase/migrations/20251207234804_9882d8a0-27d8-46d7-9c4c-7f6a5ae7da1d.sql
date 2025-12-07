
-- Create central topics table
CREATE TABLE public.topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT DEFAULT 'Tag',
  color TEXT DEFAULT '#3b82f6',
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view active topics"
  ON public.topics FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin roles can manage topics"
  ON public.topics FOR ALL
  USING (has_role(auth.uid(), 'abgeordneter'::app_role) OR has_role(auth.uid(), 'bueroleitung'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_topics_updated_at
  BEFORE UPDATE ON public.topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing tags to topics
INSERT INTO public.topics (name, label, icon, color, order_index, is_active)
SELECT name, label, COALESCE(icon, 'Tag'), COALESCE(color, '#3b82f6'), order_index, is_active
FROM public.tags
ON CONFLICT (name) DO NOTHING;

-- Add additional topics from case_file_types that aren't structural
INSERT INTO public.topics (name, label, icon, color, order_index, is_active) VALUES
  ('gesetzgebung', 'Gesetzgebung', 'Scale', '#8b5cf6', 100, true),
  ('kleine_anfrage', 'Kleine Anfrage', 'HelpCircle', '#f59e0b', 101, true),
  ('ausschussarbeit', 'Ausschussarbeit', 'Users', '#06b6d4', 102, true),
  ('wahlkreis', 'Wahlkreis', 'MapPin', '#10b981', 103, true),
  ('bildung', 'Bildung', 'GraduationCap', '#3b82f6', 104, true),
  ('wissenschaft', 'Wissenschaft', 'Microscope', '#6366f1', 105, true),
  ('verkehr', 'Verkehr', 'Car', '#64748b', 106, true),
  ('umwelt', 'Umwelt', 'Leaf', '#22c55e', 107, true),
  ('soziales', 'Soziales', 'Heart', '#ec4899', 108, true),
  ('wirtschaft', 'Wirtschaft', 'TrendingUp', '#f97316', 109, true),
  ('digitalisierung', 'Digitalisierung', 'Laptop', '#0ea5e9', 110, true),
  ('sicherheit', 'Sicherheit', 'Shield', '#ef4444', 111, true)
ON CONFLICT (name) DO NOTHING;

-- Junction table: case_file_topics
CREATE TABLE public.case_file_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_file_id UUID NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(case_file_id, topic_id)
);

ALTER TABLE public.case_file_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage case file topics"
  ON public.case_file_topics FOR ALL
  USING (EXISTS (
    SELECT 1 FROM case_files cf
    WHERE cf.id = case_file_topics.case_file_id
    AND cf.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  ));

-- Junction table: task_topics
CREATE TABLE public.task_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, topic_id)
);

ALTER TABLE public.task_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage task topics"
  ON public.task_topics FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_topics.task_id
    AND t.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  ));

-- Junction table: appointment_topics
CREATE TABLE public.appointment_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, topic_id)
);

ALTER TABLE public.appointment_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage appointment topics"
  ON public.appointment_topics FOR ALL
  USING (EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.id = appointment_topics.appointment_id
    AND a.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  ));

-- Junction table: contact_topics
CREATE TABLE public.contact_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, topic_id)
);

ALTER TABLE public.contact_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage contact topics"
  ON public.contact_topics FOR ALL
  USING (EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.id = contact_topics.contact_id
    AND c.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  ));

-- Junction table: document_topics
CREATE TABLE public.document_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(document_id, topic_id)
);

ALTER TABLE public.document_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage document topics"
  ON public.document_topics FOR ALL
  USING (EXISTS (
    SELECT 1 FROM documents d
    WHERE d.id = document_topics.document_id
    AND d.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  ));

-- Create indexes for better performance
CREATE INDEX idx_case_file_topics_case_file ON public.case_file_topics(case_file_id);
CREATE INDEX idx_case_file_topics_topic ON public.case_file_topics(topic_id);
CREATE INDEX idx_task_topics_task ON public.task_topics(task_id);
CREATE INDEX idx_task_topics_topic ON public.task_topics(topic_id);
CREATE INDEX idx_appointment_topics_appointment ON public.appointment_topics(appointment_id);
CREATE INDEX idx_appointment_topics_topic ON public.appointment_topics(topic_id);
CREATE INDEX idx_contact_topics_contact ON public.contact_topics(contact_id);
CREATE INDEX idx_contact_topics_topic ON public.contact_topics(topic_id);
CREATE INDEX idx_document_topics_document ON public.document_topics(document_id);
CREATE INDEX idx_document_topics_topic ON public.document_topics(topic_id);
