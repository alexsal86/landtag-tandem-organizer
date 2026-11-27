export const CASE_DOCUMENT_BUCKET = "case-file-documents";

/** Buckets, aus denen der Selbsttest seine eigenen Dateien wieder entfernen darf. */
export const CLEANABLE_STORAGE_BUCKETS: ReadonlySet<string> = new Set(["documents", CASE_DOCUMENT_BUCKET]);

export function documentBucket(filePath: string) {
  return filePath.startsWith("case-files/") ? CASE_DOCUMENT_BUCKET : "documents";
}
