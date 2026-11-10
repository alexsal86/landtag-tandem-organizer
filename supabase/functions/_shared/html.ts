/** Escape untrusted text before interpolating it into HTML email bodies. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

/** Only allow http(s)/mailto URLs in href attributes; returns escaped value or "#". */
export function safeUrl(value: unknown): string {
  const s = String(value ?? "").trim();
  return /^(https?:|mailto:)/i.test(s) ? escapeHtml(s) : "#";
}

/** Strip active content (scripts, frames, event handlers, javascript: URLs) from rich-text HTML. */
export function sanitizeEmailHtml(html: string): string {
  return String(html ?? "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base|svg|math)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|action|formaction)\s*=\s*("|')?\s*(javascript|vbscript|data):[^"'\s>]*\2?/gi, '$1="#"');
}
