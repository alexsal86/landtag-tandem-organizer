-- Migration: Konsolidierung der Kategorisierungssysteme

-- 1. Migriere bestehende Kontakt-Tags (contacts.tags) zu contact_topics
-- Zuerst: Erstelle Topics aus bestehenden Tags die noch nicht existieren
INSERT INTO public.topics (name, label, icon, color, is_active, order_index)
SELECT DISTINCT 
  lower(replace(replace(unnest(c.tags), ' ', '_'), '-', '_')) as name,
  unnest(c.tags) as label,
  'Tag' as icon,
  '#6b7280' as color,
  true as is_active,
  (SELECT COALESCE(MAX(order_index), 0) + 1 FROM public.topics)
FROM public.contacts c
WHERE c.tags IS NOT NULL AND array_length(c.tags, 1) > 0
ON CONFLICT (name) DO NOTHING;

-- 2. Migriere contacts.tags zu contact_topics Junction Table
INSERT INTO public.contact_topics (contact_id, topic_id)
SELECT DISTINCT
  c.id as contact_id,
  t.id as topic_id
FROM public.contacts c
CROSS JOIN LATERAL unnest(c.tags) AS tag_label
JOIN public.topics t ON lower(t.label) = lower(tag_label) OR t.name = lower(replace(replace(tag_label, ' ', '_'), '-', '_'))
WHERE c.tags IS NOT NULL AND array_length(c.tags, 1) > 0
ON CONFLICT (contact_id, topic_id) DO NOTHING;

-- 3. Entferne inhaltliche Kategorien aus task_categories (behalte nur strukturelle)
-- Inhaltliche werden durch Topics ersetzt
-- Behalte: personal, abgeordnetenbrief (strukturell)
-- Entferne: legislation, committee, constituency, mwk (inhaltlich -> Topics)
DELETE FROM public.task_categories 
WHERE name IN ('legislation', 'committee', 'constituency', 'mwk');

-- 4. Erstelle fehlende strukturelle Topics wenn noch nicht vorhanden
INSERT INTO public.topics (name, label, icon, color, description, is_active, order_index)
VALUES 
  ('gesetzgebung', 'Gesetzgebung', 'Scale', '#3b82f6', 'Gesetzgebungsverfahren und -initiativen', true, 100),
  ('ausschuss', 'Ausschuss', 'Users', '#8b5cf6', 'Ausschussarbeit im Parlament', true, 101),
  ('wahlkreis', 'Wahlkreis', 'MapPin', '#22c55e', 'Wahlkreisbezogene Themen', true, 102),
  ('mwk', 'Ministerium für Wissenschaft', 'GraduationCap', '#f97316', 'Themen des MWK', true, 103)
ON CONFLICT (name) DO NOTHING;

-- 5. Erstelle task_topics für bestehende Aufgaben basierend auf ihren Kategorien
INSERT INTO public.task_topics (task_id, topic_id)
SELECT DISTINCT
  t.id as task_id,
  top.id as topic_id
FROM public.tasks t
JOIN public.topics top ON 
  (t.category = 'legislation' AND top.name = 'gesetzgebung') OR
  (t.category = 'committee' AND top.name = 'ausschuss') OR
  (t.category = 'constituency' AND top.name = 'wahlkreis') OR
  (t.category = 'mwk' AND top.name = 'mwk')
WHERE t.category IN ('legislation', 'committee', 'constituency', 'mwk')
ON CONFLICT (task_id, topic_id) DO NOTHING;

-- 6. Aktualisiere Aufgaben mit inhaltlichen Kategorien auf 'personal'
UPDATE public.tasks
SET category = 'personal'
WHERE category IN ('legislation', 'committee', 'constituency', 'mwk');

-- 7. Füge Termin-Topics Tabelle hinzu (für zukünftige Nutzung)
-- Bereits in vorheriger Migration erstellt

-- 8. Füge fehlende Topic-Indices hinzu für Performance
CREATE INDEX IF NOT EXISTS idx_contact_topics_contact_id ON public.contact_topics(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_topics_topic_id ON public.contact_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_task_topics_task_id ON public.task_topics(task_id);
CREATE INDEX IF NOT EXISTS idx_task_topics_topic_id ON public.task_topics(topic_id);