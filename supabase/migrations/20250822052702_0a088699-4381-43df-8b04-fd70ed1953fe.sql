-- Create expense budgets table for monthly allowances
CREATE TABLE public.expense_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  budget_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, month)
);

-- Create expense categories table
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT,
  notes TEXT,
  receipt_file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expense_budgets
CREATE POLICY "Admins can manage expense budgets" 
ON public.expense_budgets 
FOR ALL 
USING (has_role(auth.uid(), 'abgeordneter'::app_role) OR has_role(auth.uid(), 'bueroleitung'::app_role));

-- RLS Policies for expense_categories
CREATE POLICY "Admins can manage expense categories" 
ON public.expense_categories 
FOR ALL 
USING (has_role(auth.uid(), 'abgeordneter'::app_role) OR has_role(auth.uid(), 'bueroleitung'::app_role));

CREATE POLICY "Authenticated users can view active expense categories" 
ON public.expense_categories 
FOR SELECT 
USING (auth.role() = 'authenticated' AND is_active = true);

-- RLS Policies for expenses
CREATE POLICY "Admins can manage all expenses" 
ON public.expenses 
FOR ALL 
USING (has_role(auth.uid(), 'abgeordneter'::app_role) OR has_role(auth.uid(), 'bueroleitung'::app_role));

-- Add foreign key constraints
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE RESTRICT;

-- Add update triggers
CREATE TRIGGER update_expense_budgets_updated_at
BEFORE UPDATE ON public.expense_budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expense_categories_updated_at
BEFORE UPDATE ON public.expense_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default expense categories
INSERT INTO public.expense_categories (name, description, color, order_index) VALUES
('Büromaterial', 'Stifte, Papier, Druckerpatronen', '#3b82f6', 0),
('Reisekosten', 'Fahrtkosten, Übernachtung, Verpflegung', '#10b981', 1),
('Kommunikation', 'Telefon, Internet, Porto', '#f59e0b', 2),
('Veranstaltungen', 'Raummiete, Catering, Technik', '#8b5cf6', 3),
('Weiterbildung', 'Seminare, Fortbildungen, Bücher', '#ef4444', 4),
('Sonstiges', 'Andere Ausgaben', '#6b7280', 5);