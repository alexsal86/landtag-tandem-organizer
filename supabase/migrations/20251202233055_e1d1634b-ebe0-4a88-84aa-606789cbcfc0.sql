-- Neue Notification Types für Entscheidungs-Kommentare
INSERT INTO notification_types (name, label, description, is_active) 
SELECT 'task_decision_comment_received', 'Kommentar zu Entscheidungsanfrage', 'Benachrichtigung wenn jemand auf eine Entscheidungsanfrage mit Kommentar antwortet', true
WHERE NOT EXISTS (SELECT 1 FROM notification_types WHERE name = 'task_decision_comment_received');

INSERT INTO notification_types (name, label, description, is_active) 
SELECT 'task_decision_creator_response', 'Antwort auf Ihren Kommentar', 'Benachrichtigung wenn der Ersteller auf Ihren Kommentar antwortet', true
WHERE NOT EXISTS (SELECT 1 FROM notification_types WHERE name = 'task_decision_creator_response');

-- Mapping zu decisions Kontext
INSERT INTO notification_navigation_mapping (notification_type_name, navigation_context) 
SELECT 'task_decision_comment_received', 'decisions'
WHERE NOT EXISTS (SELECT 1 FROM notification_navigation_mapping WHERE notification_type_name = 'task_decision_comment_received');

INSERT INTO notification_navigation_mapping (notification_type_name, navigation_context) 
SELECT 'task_decision_creator_response', 'decisions'
WHERE NOT EXISTS (SELECT 1 FROM notification_navigation_mapping WHERE notification_type_name = 'task_decision_creator_response');

-- Korrigiere Mapping von "employees" zu "employee" (passend zur Navigation ID)
UPDATE notification_navigation_mapping 
SET navigation_context = 'employee' 
WHERE navigation_context = 'employees';