
-- 1. Create case_file_processing_statuses table
CREATE TABLE public.case_file_processing_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT DEFAULT 'Circle',
  color TEXT DEFAULT '#6b7280',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.case_file_processing_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view processing statuses"
  ON public.case_file_processing_statuses FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage processing statuses"
  ON public.case_file_processing_statuses FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default statuses
INSERT INTO public.case_file_processing_statuses (name, label, icon, color, order_index) VALUES
  ('new', 'Neu eingegangen', 'Inbox', '#3b82f6', 0),
  ('in_review', 'In Prüfung', 'Search', '#8b5cf6', 1),
  ('in_progress_ministry', 'In Bearbeitung (Ministerium)', 'Building2', '#f59e0b', 2),
  ('awaiting_response', 'Antwort ausstehend', 'Clock', '#ef4444', 3),
  ('politically_sensitive', 'Politisch sensibel ⚠️', 'AlertTriangle', '#dc2626', 4),
  ('completed', 'Erledigt / Abgeschlossen', 'CheckCircle', '#22c55e', 5);

-- 2. Add processing_status column to case_files
ALTER TABLE public.case_files ADD COLUMN processing_status TEXT;

-- 3. Create case_file_status_history table
CREATE TABLE public.case_file_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_file_id UUID NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  content TEXT,
  user_id UUID NOT NULL,
  user_display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.case_file_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view status history for accessible case files"
  ON public.case_file_status_history FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert status history"
  ON public.case_file_status_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Add parent_task_id to tasks table
ALTER TABLE public.tasks ADD COLUMN parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;
