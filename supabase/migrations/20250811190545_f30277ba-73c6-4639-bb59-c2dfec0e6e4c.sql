-- Update the Standard Meeting Template with existing sub-items from meetings
UPDATE public.meeting_templates 
SET template_items = '[
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
    "children": [
      {
        "title": "Rückmeldung zu laufenden Projekten und Deadlines",
        "description": "",
        "order_index": 0
      }
    ]
  },
  {
    "title": "Verschiedenes",
    "description": null,
    "order_index": 6,
    "children": [
      {
        "title": "Pressemitteilung Umweltpolitik",
        "description": "Entwurf für Pressemitteilung zur neuen Umweltinitiative",
        "order_index": 0
      }
    ]
  }
]'::jsonb
WHERE name = 'Standard Meeting Template';