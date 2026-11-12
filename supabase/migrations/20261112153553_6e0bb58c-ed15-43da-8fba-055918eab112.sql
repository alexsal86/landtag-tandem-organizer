UPDATE public.contacts SET position = COALESCE(NULLIF(position,''), NULLIF(role,''), NULLIF(department,''))
 WHERE COALESCE(position,'') = '' AND (COALESCE(role,'')<>'' OR COALESCE(department,'')<>'');

UPDATE public.contacts SET notes = trim(both E'\n' from concat_ws(E'\n', NULLIF(notes,''),
  CASE WHEN COALESCE(email_2,'')<>'' THEN 'Weitere E-Mail: '||email_2 END,
  CASE WHEN COALESCE(email_3,'')<>'' THEN 'Weitere E-Mail: '||email_3 END,
  CASE WHEN COALESCE(department,'')<>'' AND department IS DISTINCT FROM position THEN 'Abteilung: '||department END,
  CASE WHEN COALESCE(role,'')<>'' AND role IS DISTINCT FROM position THEN 'Rolle: '||role END,
  CASE WHEN COALESCE(xing,'')<>'' THEN 'Xing: '||xing END,
  CASE WHEN COALESCE(twitter,'')<>'' THEN 'X/Twitter: '||twitter END))
 WHERE COALESCE(email_2,'')<>'' OR COALESCE(email_3,'')<>'' OR COALESCE(department,'')<>'' OR COALESCE(role,'')<>'' OR COALESCE(xing,'')<>'' OR COALESCE(twitter,'')<>'';

ALTER TABLE public.contacts DROP COLUMN email_2, DROP COLUMN email_3, DROP COLUMN department, DROP COLUMN role, DROP COLUMN xing, DROP COLUMN twitter, DROP COLUMN geocoding_source;