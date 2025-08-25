-- Update all existing users to use the standard dashboard layout
UPDATE team_dashboards 
SET layout_data = '[
  {
    "id": "stats",
    "type": "stats", 
    "title": "Schnellstatistiken",
    "position": {"x": 0, "y": 0},
    "size": {"width": 3, "height": 1},
    "widgetSize": "3x1",
    "configuration": {"theme": "default", "refreshInterval": 300}
  },
  {
    "id": "pomodoro",
    "type": "pomodoro",
    "title": "Pomodoro Timer", 
    "position": {"x": 3, "y": 0},
    "size": {"width": 2, "height": 1},
    "widgetSize": "2x1",
    "configuration": {"theme": "default", "notifications": true}
  },
  {
    "id": "messages",
    "type": "messages",
    "title": "Nachrichten",
    "position": {"x": 5, "y": 0},
    "size": {"width": 3, "height": 1}, 
    "widgetSize": "3x1",
    "configuration": {"theme": "default", "notifications": true}
  },
  {
    "id": "tasks",
    "type": "tasks",
    "title": "Ausstehende Aufgaben",
    "position": {"x": 0, "y": 1},
    "size": {"width": 3, "height": 2},
    "widgetSize": "3x2", 
    "configuration": {"theme": "default", "showHeader": true}
  },
  {
    "id": "quicknotes",
    "type": "quicknotes",
    "title": "Quick Notes",
    "position": {"x": 3, "y": 1},
    "size": {"width": 2, "height": 2},
    "widgetSize": "2x2",
    "configuration": {"theme": "default", "autoSave": true, "compact": false}
  },
  {
    "id": "habits", 
    "type": "habits",
    "title": "Habit Tracker",
    "position": {"x": 5, "y": 1},
    "size": {"width": 3, "height": 2},
    "widgetSize": "3x2",
    "configuration": {"theme": "default", "showStreak": true}
  },
  {
    "id": "schedule",
    "type": "schedule", 
    "title": "Heutiger Terminplan",
    "position": {"x": 0, "y": 3},
    "size": {"width": 3, "height": 2},
    "widgetSize": "3x2",
    "configuration": {"theme": "default", "compact": false}
  },
  {
    "id": "calllog",
    "type": "calllog",
    "title": "Call Log",
    "position": {"x": 3, "y": 3}, 
    "size": {"width": 3, "height": 2},
    "widgetSize": "3x2",
    "configuration": {"theme": "default", "showFollowUps": true}
  },
  {
    "id": "actions",
    "type": "actions",
    "title": "Schnellaktionen",
    "position": {"x": 0, "y": 5},
    "size": {"width": 8, "height": 1},
    "widgetSize": "8x1",
    "configuration": {"theme": "default", "showIcons": true}
  }
]'::jsonb,
name = 'Standard Layout',
updated_at = now()
WHERE owner_id IN (SELECT user_id FROM profiles);