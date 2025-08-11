-- Update the Standard Meeting Template with all correct sub-items from meetings
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
    "children": [
      {
        "title": "Rückblick auf vergangene Plenarsitzungen, Ausschusssitzungen, Fraktionssitzungen",
        "description": null,
        "order_index": 0
      },
      {
        "title": "Wichtige Beschlüsse, Gesetze, Debatten",
        "description": null,
        "order_index": 1
      },
      {
        "title": "Anstehende Termine und Fraktionspositionen",
        "description": null,
        "order_index": 2
      },
      {
        "title": "Offene Punkte, bei denen Handlungsbedarf besteht",
        "description": null,
        "order_index": 3
      }
    ]
  },
  {
    "title": "Politische Schwerpunktthemen & Projekte",
    "description": null,
    "order_index": 2,
    "children": [
      {
        "title": "Laufende politische Initiativen (z. B. Gesetzesvorhaben, Anträge, Kleine Anfragen)",
        "description": null,
        "order_index": 0
      },
      {
        "title": "Vorbereitung auf anstehende Reden, Stellungnahmen, Medienbeiträge",
        "description": null,
        "order_index": 1
      },
      {
        "title": "Strategische Planung zu Kernthemen des Abgeordneten",
        "description": null,
        "order_index": 2
      },
      {
        "title": "Recherche- und Hintergrundaufträge an Mitarbeiter",
        "description": null,
        "order_index": 3
      }
    ]
  },
  {
    "title": "Wahlkreisarbeit",
    "description": null,
    "order_index": 3,
    "children": [
      {
        "title": "Aktuelle Anliegen aus dem Wahlkreis (Bürgeranfragen, Vereine, Unternehmen, Kommunen)",
        "description": null,
        "order_index": 0
      },
      {
        "title": "Geplante Wahlkreisbesuche und Gesprächstermine",
        "description": null,
        "order_index": 1
      },
      {
        "title": "Veranstaltungen im Wahlkreis (Planung, Teilnahme, Redeinhalte)",
        "description": null,
        "order_index": 2
      },
      {
        "title": "Presse- und Öffentlichkeitsarbeit vor Ort",
        "description": null,
        "order_index": 3
      }
    ]
  },
  {
    "title": "Kommunikation & Öffentlichkeitsarbeit",
    "description": null,
    "order_index": 4,
    "children": [
      {
        "title": "Social Media: Planung und Freigabe von Beiträgen, Abstimmung von Inhalten",
        "description": null,
        "order_index": 0
      },
      {
        "title": "Pressearbeit: Pressemeldungen, Interviews, Pressegespräche",
        "description": null,
        "order_index": 1
      },
      {
        "title": "Newsletter, Website-Updates",
        "description": null,
        "order_index": 2
      },
      {
        "title": "Abstimmung mit Fraktions-Pressestelle",
        "description": null,
        "order_index": 3
      }
    ]
  },
  {
    "title": "Organisation & Bürointerna",
    "description": null,
    "order_index": 5,
    "children": [
      {
        "title": "Aufgabenverteilung im Team",
        "description": null,
        "order_index": 0
      },
      {
        "title": "Rückmeldung zu laufenden Projekten und Deadlines",
        "description": null,
        "order_index": 1
      },
      {
        "title": "Büroorganisation, Urlaubsplanung, Vertretungsregelungen",
        "description": null,
        "order_index": 2
      },
      {
        "title": "Technische und administrative Fragen",
        "description": null,
        "order_index": 3
      }
    ]
  },
  {
    "title": "Verschiedenes",
    "description": null,
    "order_index": 6,
    "children": []
  }
]'::jsonb
WHERE name = 'Standard Meeting Template';