export interface CitationInput {
  title: string;
  values: string[];
  source: string;
  release?: string | null;
  url?: string | null;
  accessedAt?: string;
}

/** A copyable "number citation": the visible figures, their source, data release and access date. */
export function citationText(input: CitationInput): string {
  const figures = input.values.map((value) => value.trim()).filter(Boolean);
  const source = [
    input.source,
    input.release ? `Datenstand ${input.release}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const parts = [`„${input.title}: ${figures.join(" · ")}“`, `Quelle: ${source}`];
  if (input.url) parts.push(input.url);
  if (input.accessedAt) parts.push(`abgerufen am ${input.accessedAt}`);
  return parts.join(" — ");
}

export function todayLabel(now: Date = new Date()): string {
  return now.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Filesystem-safe stem; umlauts stay readable, separators collapse. */
export function fileStem(value: string): string {
  const stem = value
    .normalize("NFC")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return stem || "grafik";
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "true");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}
