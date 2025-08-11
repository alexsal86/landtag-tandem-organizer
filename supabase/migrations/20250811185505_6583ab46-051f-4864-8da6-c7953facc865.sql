-- Create a default meeting template with standard agenda items
INSERT INTO public.meeting_templates (
  name, 
  description, 
  user_id, 
  template_items
) VALUES (
  'Standard Meeting Template',
  'Standard-Agenda für alle Meetings',
  (SELECT id FROM auth.users LIMIT 1),
  '[
    {
      "title": "Begrüßung",
      "description": null,
      "order_index": 0,
      "children": []
    },
    {
      "title": "Aktuelles aus dem Landtag",
      "description": null,
      "order_index": 1,
      "children": []
    },
    {
      "title": "Politische Schwerpunktthemen & Projekte",
      "description": null,
      "order_index": 2,
      "children": []
    },
    {
      "title": "Wahlkreisarbeit",
      "description": null,
      "order_index": 3,
      "children": []
    },
    {
      "title": "Kommunikation & Öffentlichkeitsarbeit",
      "description": null,
      "order_index": 4,
      "children": []
    },
    {
      "title": "Organisation & Bürointerna",
      "description": null,
      "order_index": 5,
      "children": []
    },
    {
      "title": "Verschiedenes",
      "description": null,
      "order_index": 6,
      "children": []
    }
  ]'::jsonb
) ON CONFLICT DO NOTHING;