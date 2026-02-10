UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  ARRAY['message/rfc822', 'application/vnd.ms-outlook', 'application/octet-stream']
)
WHERE id = 'decision-attachments';