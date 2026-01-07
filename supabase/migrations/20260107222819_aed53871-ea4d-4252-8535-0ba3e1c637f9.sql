-- Jährliche Aufgaben Tabelle
CREATE TABLE IF NOT EXISTS public.annual_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'admin',
  due_month INTEGER NOT NULL CHECK (due_month >= 1 AND due_month <= 12),
  due_day INTEGER CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
  is_system_task BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Erledigungs-Tracking
CREATE TABLE IF NOT EXISTS public.annual_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_task_id UUID REFERENCES public.annual_tasks(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(annual_task_id, year)
);

-- RLS aktivieren
ALTER TABLE public.annual_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_task_completions ENABLE ROW LEVEL SECURITY;

-- Policies für annual_tasks (nutze is_admin Funktion)
CREATE POLICY "Users can view annual tasks in their tenant" ON public.annual_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships 
      WHERE user_id = auth.uid() 
      AND tenant_id = annual_tasks.tenant_id
      AND is_active = true
    )
  );

CREATE POLICY "Admins can manage annual tasks" ON public.annual_tasks
  FOR ALL USING (
    public.is_admin(auth.uid())
  );

-- Policies für annual_task_completions
CREATE POLICY "Users can view completions" ON public.annual_task_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.annual_tasks at
      JOIN public.user_tenant_memberships utm ON utm.tenant_id = at.tenant_id
      WHERE at.id = annual_task_completions.annual_task_id
      AND utm.user_id = auth.uid()
      AND utm.is_active = true
    )
  );

CREATE POLICY "Admins can manage completions" ON public.annual_task_completions
  FOR ALL USING (
    public.is_admin(auth.uid())
  );

-- Standard jährliche Aufgaben einfügen (für bestehende Tenants)
INSERT INTO public.annual_tasks (tenant_id, title, description, category, due_month, due_day, is_system_task)
SELECT 
  t.id,
  task.title,
  task.description,
  task.category,
  task.due_month,
  task.due_day,
  true
FROM public.tenants t
CROSS JOIN (
  VALUES 
    ('Urlaubstage zurücksetzen', 'Jahresanspruch auf neue Periode setzen und Resturlaub berechnen', 'employee', 1, 1),
    ('Krankentage-Statistik archivieren', 'Krankheitstage des Vorjahres archivieren und auswerten', 'employee', 1, 15),
    ('Jahresrückblick erstellen', 'Zusammenfassung der wichtigsten Ereignisse und Statistiken', 'admin', 1, 31),
    ('Resturlaub verfällt', 'Erinnerung: Resturlaub aus dem Vorjahr verfällt spätestens Ende März', 'employee', 3, 31),
    ('Halbjahresbilanz', 'Zwischenstand der Jahresziele und Aufgaben', 'admin', 7, 1),
    ('Urlaubsplanung nächstes Jahr', 'Mitarbeiter zur Urlaubsplanung für das kommende Jahr auffordern', 'calendar', 11, 1),
    ('Jahresende-Statistiken', 'Alle Statistiken für den Jahresabschluss vorbereiten', 'system', 12, 15)
) AS task(title, description, category, due_month, due_day)
ON CONFLICT DO NOTHING;