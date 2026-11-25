const prefix = "office-feedback-draft:";

export function officeFeedbackDraftKey(tenant: string, user: string, event: string) {
  return `${prefix}${tenant}:${user}:${event}`;
}

export function readOfficeFeedbackDraft(key: string | undefined): string {
  if (!key) return "";
  try { return localStorage.getItem(key) ?? ""; }
  catch { return ""; }
}

export function writeOfficeFeedbackDraft(key: string, value: string) {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}
