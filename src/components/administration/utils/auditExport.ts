import Papa from "papaparse";
export type ExportLog = { id: string; created_at: string; ip_address: string | null; payload: unknown };
export type ExportPage = { asOf: string; logs: ExportLog[] };
export type ExportCursor = { asOf?: string; beforeCreated?: string; beforeId?: string };

export async function collectAuditCsv(
  read: (cursor: ExportCursor, signal: AbortSignal) => Promise<ExportPage>,
  signal: AbortSignal,
  progress: (count: number) => void,
): Promise<Blob> {
  let cursor: ExportCursor = {};
  let count = 0;
  const chunks: BlobPart[] = ["\uFEFF"];
  let previousCursor = "";
  do {
    signal.throwIfAborted();
    const page = await read(cursor, signal);
    signal.throwIfAborted();
    if (!page.logs.length) break;
    chunks.push(Papa.unparse(page.logs.map(log => ({
      Zeitstempel: log.created_at,
      "IP-Adresse": log.ip_address ?? "",
      Aktion: log.payload && typeof log.payload === "object" && "action" in log.payload ? String(log.payload.action) : "Unbekannt",
      Details: JSON.stringify(log.payload),
    })), { header: count === 0, escapeFormulae: true }) + "\r\n");
    count += page.logs.length;
    progress(count);
    const last = page.logs[page.logs.length - 1];
    const key = `${last.created_at}:${last.id}`;
    if (key === previousCursor) throw new Error("Der Export-Cursor ist nicht fortgeschritten.");
    previousCursor = key;
    cursor = { asOf: page.asOf, beforeCreated: last.created_at, beforeId: last.id };
    if (page.logs.length < 500) break;
  } while (cursor.beforeId);
  return new Blob(chunks, { type: "text/csv;charset=utf-8;" });
}
