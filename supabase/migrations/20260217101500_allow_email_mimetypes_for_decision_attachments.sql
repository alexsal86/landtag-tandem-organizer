-- Allow uploading email files (.eml/.msg) to decision attachments
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'message/rfc822',
  'application/vnd.ms-outlook',
  'application/octet-stream'
]
WHERE id = 'decision-attachments';
