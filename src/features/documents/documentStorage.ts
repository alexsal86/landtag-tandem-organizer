export const CASE_DOCUMENT_BUCKET = "case-file-documents";

export function documentBucket(filePath: string) {
  return filePath.startsWith("case-files/") ? CASE_DOCUMENT_BUCKET : "documents";
}
