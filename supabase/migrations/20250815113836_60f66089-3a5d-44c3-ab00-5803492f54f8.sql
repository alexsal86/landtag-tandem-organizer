-- Update the Standard Meeting Template to include sub-items
UPDATE public.meeting_templates 
SET template_items = '[
  {
    "title": "Begrüßung",
    "order_index": 0,
    "type": "item",
    "children": []
  },
  {
    "title": "Aktuelles aus dem Landtag",
    "order_index": 1,
    "type": "item",
    "children": [
      {"title": "Plenum", "order_index": 0},
      {"title": "Ausschüsse", "order_index": 1},
      {"title": "Fraktion", "order_index": 2}
    ]
  },
  {
    "title": "Politische Schwerpunktthemen & Projekte",
    "order_index": 2,
    "type": "item",
    "children": [
      {"title": "Aktuelle Projekte", "order_index": 0},
      {"title": "Neue Initiativen", "order_index": 1}
    ]
  },
  {
    "title": "Wahlkreisarbeit",
    "order_index": 3,
    "type": "item",
    "children": [
      {"title": "Termine", "order_index": 0},
      {"title": "Bürgersprechstunden", "order_index": 1},
      {"title": "Ortstermine", "order_index": 2}
    ]
  },
  {
    "title": "Kommunikation & Öffentlichkeitsarbeit",
    "order_index": 4,
    "type": "item",
    "children": [
      {"title": "Social Media", "order_index": 0},
      {"title": "Pressetermine", "order_index": 1},
      {"title": "Website", "order_index": 2}
    ]
  },
  {
    "title": "Organisation & Bürointerna",
    "order_index": 5,
    "type": "item",
    "children": [
      {"title": "Personal", "order_index": 0},
      {"title": "Budget", "order_index": 1},
      {"title": "Termine", "order_index": 2}
    ]
  },
  {
    "title": "Verschiedenes",
    "order_index": 6,
    "type": "item",
    "children": []
  }
]'::jsonb
WHERE name = 'Standard Meeting Template';