-- Neue Tags erstellen
INSERT INTO tags (name, label, color, is_active, order_index) VALUES
('landesregierung', 'Landesregierung', '#0d9488', true, 10),
('hochschule', 'Hochschule', '#8b5cf6', true, 11),
('bundestag', 'Bundestag', '#1d4ed8', true, 12),
('polizei', 'Polizei', '#64748b', true, 13),
('gewerkschaft', 'Gewerkschaft', '#f59e0b', true, 14),
('kultur', 'Kultur', '#ec4899', true, 15)
ON CONFLICT (name) DO NOTHING;

-- Landtag-Tag zuweisen
UPDATE contacts 
SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'Landtag')
WHERE (email ILIKE '%landtag-bw.de' OR email ILIKE '%landtag.nrw.de')
  AND (tags IS NULL OR NOT 'Landtag' = ANY(tags));

-- Landesregierung-Tag zuweisen (alle .bwl.de Domains außer Landtag und Polizei)
UPDATE contacts 
SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'Landesregierung')
WHERE email ILIKE '%.bwl.de'
  AND email NOT ILIKE '%landtag%'
  AND email NOT ILIKE '%polizei%'
  AND (tags IS NULL OR NOT 'Landesregierung' = ANY(tags));

-- Bundestag-Tag zuweisen
UPDATE contacts 
SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'Bundestag')
WHERE email ILIKE '%@bundestag.de'
  AND (tags IS NULL OR NOT 'Bundestag' = ANY(tags));

-- Presse-Tag zuweisen
UPDATE contacts 
SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'Presse')
WHERE (email ILIKE '%@swr.de' OR email ILIKE '%@rnf.de' 
       OR email ILIKE '%regio-tv.de' OR email ILIKE '%stz.zgs.de')
  AND (tags IS NULL OR NOT 'Presse' = ANY(tags));

-- Hochschule-Tag zuweisen
UPDATE contacts 
SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'Hochschule')
WHERE (email ILIKE '%@kit.edu' OR email ILIKE '%hs-karlsruhe.de' 
       OR email ILIKE '%ph-karlsruhe.de' OR email ILIKE '%@fzi.de')
  AND (tags IS NULL OR NOT 'Hochschule' = ANY(tags));

-- Karlsruhe-Tag zuweisen
UPDATE contacts 
SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'Karlsruhe')
WHERE (email ILIKE '%@karlsruhe.de' OR email ILIKE '%gemeinderat.karlsruhe.de'
       OR email ILIKE '%kultur.karlsruhe.de' OR email ILIKE '%@cyberforum.de')
  AND (tags IS NULL OR NOT 'Karlsruhe' = ANY(tags));

-- Partei-Tag zuweisen
UPDATE contacts 
SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'Partei')
WHERE email ILIKE '%gruene-fraktion%'
  AND (tags IS NULL OR NOT 'Partei' = ANY(tags));

-- Polizei-Tag zuweisen
UPDATE contacts 
SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'Polizei')
WHERE email ILIKE '%polizei.bwl.de'
  AND (tags IS NULL OR NOT 'Polizei' = ANY(tags));

-- Gewerkschaft-Tag zuweisen
UPDATE contacts 
SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'Gewerkschaft')
WHERE (email ILIKE '%@verdi.de' OR email ILIKE '%@igmetall.de' 
       OR email ILIKE '%@djv-bw.de')
  AND (tags IS NULL OR NOT 'Gewerkschaft' = ANY(tags));

-- Kultur-Tag zuweisen
UPDATE contacts 
SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'Kultur')
WHERE (email ILIKE '%@zkm.de' OR email ILIKE '%landesmuseum.de' 
       OR email ILIKE '%staatstheater%')
  AND (tags IS NULL OR NOT 'Kultur' = ANY(tags));