-- Create planning templates table
CREATE TABLE public.planning_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  template_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.planning_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can create all planning templates" 
ON public.planning_templates 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view all planning templates" 
ON public.planning_templates 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all planning templates" 
ON public.planning_templates 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all planning templates" 
ON public.planning_templates 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Add template_id to event_plannings table
ALTER TABLE public.event_plannings 
ADD COLUMN template_id UUID REFERENCES public.planning_templates(id);

-- Add sub_items to event_planning_checklist_items
ALTER TABLE public.event_planning_checklist_items 
ADD COLUMN sub_items JSONB DEFAULT '[]'::jsonb;

-- Create default planning template
INSERT INTO public.planning_templates (user_id, name, description, template_items)
SELECT 
  (SELECT user_id FROM public.profiles LIMIT 1),
  'Standard Planungs-Template',
  'Standard-Checkliste für Eventplanung',
  '[
    {"title": "Social Media geplant", "description": "", "order_index": 0, "sub_items": []},
    {"title": "Begleitung erwünscht", "description": "", "order_index": 1, "sub_items": []},
    {"title": "Information an Kreisverband", "description": "", "order_index": 2, "sub_items": []},
    {"title": "Information an Gemeinderatsfraktion", "description": "", "order_index": 3, "sub_items": []},
    {"title": "Information an Abgeordnete", "description": "", "order_index": 4, "sub_items": []},
    {"title": "Pressemitteilung vorbereitet", "description": "", "order_index": 5, "sub_items": []},
    {"title": "Technik überprüft", "description": "", "order_index": 6, "sub_items": []},
    {"title": "Catering organisiert", "description": "", "order_index": 7, "sub_items": []},
    {"title": "Einladungen verschickt", "description": "", "order_index": 8, "sub_items": []},
    {"title": "Nachbereitung geplant", "description": "", "order_index": 9, "sub_items": []}
  ]'::jsonb
WHERE EXISTS (SELECT 1 FROM public.profiles LIMIT 1);

-- Update create_default_checklist_items function to use template
CREATE OR REPLACE FUNCTION public.create_default_checklist_items(planning_id uuid, template_id_param uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  template_data jsonb;
  item jsonb;
BEGIN
  -- If template_id is provided, use template items
  IF template_id_param IS NOT NULL THEN
    SELECT template_items INTO template_data 
    FROM public.planning_templates 
    WHERE id = template_id_param;
    
    IF template_data IS NOT NULL THEN
      FOR item IN SELECT * FROM jsonb_array_elements(template_data)
      LOOP
        INSERT INTO public.event_planning_checklist_items (
          event_planning_id, title, order_index, sub_items
        ) VALUES (
          planning_id, 
          item->>'title', 
          (item->>'order_index')::int,
          COALESCE(item->'sub_items', '[]'::jsonb)
        );
      END LOOP;
    END IF;
  ELSE
    -- Fallback to default items if no template
    INSERT INTO public.event_planning_checklist_items (event_planning_id, title, order_index) VALUES
      (planning_id, 'Social Media geplant', 0),
      (planning_id, 'Begleitung erwünscht', 1),
      (planning_id, 'Information an Kreisverband', 2),
      (planning_id, 'Information an Gemeinderatsfraktion', 3),
      (planning_id, 'Information an Abgeordnete', 4),
      (planning_id, 'Pressemitteilung vorbereitet', 5),
      (planning_id, 'Technik überprüft', 6),
      (planning_id, 'Catering organisiert', 7),
      (planning_id, 'Einladungen verschickt', 8),
      (planning_id, 'Nachbereitung geplant', 9);
  END IF;
END;
$function$;