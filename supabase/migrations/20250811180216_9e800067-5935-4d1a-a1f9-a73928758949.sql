-- Create table for configurable appointment categories
CREATE TABLE public.appointment_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for configurable appointment statuses
CREATE TABLE public.appointment_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for configurable task categories
CREATE TABLE public.task_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for configurable task statuses
CREATE TABLE public.task_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all configuration tables
ALTER TABLE public.appointment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;

-- Create policies - only Abgeordneter and Büroleitung can manage these
CREATE POLICY "Admin roles can manage appointment categories" 
ON public.appointment_categories 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'abgeordneter') OR 
  public.has_role(auth.uid(), 'bueroleitung')
);

CREATE POLICY "Admin roles can manage appointment statuses" 
ON public.appointment_statuses 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'abgeordneter') OR 
  public.has_role(auth.uid(), 'bueroleitung')
);

CREATE POLICY "Admin roles can manage task categories" 
ON public.task_categories 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'abgeordneter') OR 
  public.has_role(auth.uid(), 'bueroleitung')
);

CREATE POLICY "Admin roles can manage task statuses" 
ON public.task_statuses 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'abgeordneter') OR 
  public.has_role(auth.uid(), 'bueroleitung')
);

-- Authenticated users can view these (needed for forms)
CREATE POLICY "Authenticated users can view appointment categories" 
ON public.appointment_categories 
FOR SELECT 
USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Authenticated users can view appointment statuses" 
ON public.appointment_statuses 
FOR SELECT 
USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Authenticated users can view task categories" 
ON public.task_categories 
FOR SELECT 
USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Authenticated users can view task statuses" 
ON public.task_statuses 
FOR SELECT 
USING (auth.role() = 'authenticated' AND is_active = true);

-- Add triggers for updated_at
CREATE TRIGGER update_appointment_categories_updated_at
BEFORE UPDATE ON public.appointment_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointment_statuses_updated_at
BEFORE UPDATE ON public.appointment_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_categories_updated_at
BEFORE UPDATE ON public.task_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_statuses_updated_at
BEFORE UPDATE ON public.task_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default appointment categories
INSERT INTO public.appointment_categories (name, label, order_index) VALUES
('meeting', 'Meeting', 1),
('appointment', 'Termin', 2),
('session', 'Sitzung', 3),
('deadline', 'Deadline', 4),
('blocked', 'Geblockt', 5);

-- Insert default appointment statuses
INSERT INTO public.appointment_statuses (name, label, order_index) VALUES
('planned', 'Geplant', 1),
('confirmed', 'Bestätigt', 2),
('completed', 'Abgeschlossen', 3),
('cancelled', 'Abgesagt', 4);

-- Insert default task categories
INSERT INTO public.task_categories (name, label, order_index) VALUES
('legislation', 'Gesetzgebung', 1),
('committee', 'Ausschuss', 2),
('constituency', 'Wahlkreis', 3),
('personal', 'Persönlich', 4);

-- Insert default task statuses
INSERT INTO public.task_statuses (name, label, order_index) VALUES
('todo', 'To-Do', 1),
('in_progress', 'In Bearbeitung', 2),
('review', 'Zur Überprüfung', 3),
('done', 'Erledigt', 4),
('cancelled', 'Abgebrochen', 5);