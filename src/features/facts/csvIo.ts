import Papa from "papaparse";
import type { FactRow, FactInput } from "./types";
import { notify } from "@/lib/notify";

const COLUMNS = ["text", "source", "tags", "valid_until", "is_archived"] as const;

export function exportFactsToCsv(facts: FactRow[]): void {
  const rows = facts.map((f) => ({
    text: f.text,
    source: f.source ?? "",
    tags: (f.tags ?? []).join("|"),
    valid_until: f.valid_until ?? "",
    is_archived: f.is_archived ? "true" : "false",
  }));
  const csv = Papa.unparse(rows, { columns: [...COLUMNS] });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fakten-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ParsedFactImport {
  rows: FactInput[];
  skipped: number;
  errors: string[];
}

export async function parseFactsCsv(file: File): Promise<ParsedFactImport> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const errors: string[] = result.errors.map((e) => `Zeile ${e.row}: ${e.message}`);
        const rows: FactInput[] = [];
        let skipped = 0;
        for (const r of result.data) {
          const text = (r.text ?? r.Text ?? "").trim();
          if (!text) { skipped++; continue; }
          const tagsRaw = (r.tags ?? r.Tags ?? "").trim();
          const tags = tagsRaw ? tagsRaw.split(/[|,;]/).map((t) => t.trim()).filter(Boolean) : [];
          const validUntil = (r.valid_until ?? "").trim();
          rows.push({
            text,
            source: (r.source ?? "").trim() || null,
            tags,
            valid_until: validUntil || null,
            is_archived: /^(true|1|ja|yes)$/i.test((r.is_archived ?? "").trim()),
          });
        }
        resolve({ rows, skipped, errors });
      },
      error: (err) => {
        notify.error(`CSV-Fehler: ${err.message}`);
        resolve({ rows: [], skipped: 0, errors: [err.message] });
      },
    });
  });
}
