export const stripHtml = (value: string): string =>
  value.replace(/<[^>]*>/g, "").trim();

export const toEditorHtml = (value: string | null | undefined): string => {
  if (!value) return "";
  if (/<[^>]+>/.test(value)) return value;
  return `<p>${value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</p>`;
};
