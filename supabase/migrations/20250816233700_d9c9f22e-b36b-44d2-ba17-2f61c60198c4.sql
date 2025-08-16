-- Create todo_categories table
CREATE TABLE public.todo_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  color CHARACTER VARYING(7) DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on todo_categories
ALTER TABLE public.todo_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for todo_categories
CREATE POLICY "Admin roles can manage todo categories" 
ON public.todo_categories 
FOR ALL 
USING (has_role(auth.uid(), 'abgeordneter'::app_role) OR has_role(auth.uid(), 'bueroleitung'::app_role));

CREATE POLICY "Authenticated users can view todo categories" 
ON public.todo_categories 
FOR SELECT 
USING ((auth.role() = 'authenticated'::text) AND (is_active = true));

-- Create todos table
CREATE TABLE public.todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.todo_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on todos
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Create policies for todos
CREATE POLICY "Authenticated users can create all todos" 
ON public.todos 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can view all todos" 
ON public.todos 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can update all todos" 
ON public.todos 
FOR UPDATE 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can delete all todos" 
ON public.todos 
FOR DELETE 
USING (auth.role() = 'authenticated'::text);

-- Create trigger for updated_at on todo_categories
CREATE TRIGGER update_todo_categories_updated_at
BEFORE UPDATE ON public.todo_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on todos
CREATE TRIGGER update_todos_updated_at
BEFORE UPDATE ON public.todos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default todo categories
INSERT INTO public.todo_categories (name, label, color, order_index) VALUES
('wichtig', 'Wichtig', '#ef4444', 0),
('erinnerung', 'Erinnerung', '#f59e0b', 1),
('termine', 'Termine', '#10b981', 2),
('nachfassen', 'Nachfassen', '#8b5cf6', 3),
('info', 'Info', '#06b6d4', 4);