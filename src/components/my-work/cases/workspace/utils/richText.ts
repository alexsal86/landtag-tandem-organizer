export const normalizeRichTextValue = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutTags = trimmed
    .replace(/<p><br><\/p>/gi, "")
    .replace(/<br\s*\/?/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, "")
    .trim();
  return withoutTags ? trimmed : null;
};

export const richTextToPlain = (value: string | null | undefined): string => {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
};
