-- Amtlicher PDF-Link aus TOP 5 der 16. Plenarsitzung vom 5. November 2026.
WITH urls (old_url, new_url) AS (
  VALUES (
    'https://www.landtag-bw.de/files/live/sites/LTBW/files/dokumente/WP18/Drucksachen/0000/18%5F0763.pdf',
    'https://www.landtag-bw.de/resource/blob/663370/5644da87e4bd3bfb1531b023ef731561/18_0763_D.pdf'
  )
)
UPDATE public.parlis_proceedings AS proceeding
SET pdf_url = urls.new_url || substr(proceeding.pdf_url, length(urls.old_url) + 1),
    dokument_url = urls.new_url
FROM urls
WHERE proceeding.legislature = 18
  AND proceeding.dokument_url = urls.old_url
  AND proceeding.pdf_url IN (urls.old_url, urls.old_url || '#page=1', urls.old_url || '#page=2');
