import { CaseFileDocument } from "@/features/cases/files/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface CaseFileDocumentsCardProps {
  documents: CaseFileDocument[];
  onAdd?: () => void;
}

function fileExt(name?: string | null): string {
  if (!name) return "DOC";
  const m = name.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] || "DOC").toUpperCase();
}

function fileSize(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CaseFileDocumentsCard({ documents, onAdd }: CaseFileDocumentsCardProps) {
  const sorted = [...documents].sort((a, b) => {
    const da = a.document?.created_at ?? a.created_at;
    const db = b.document?.created_at ?? b.created_at;
    return new Date(db).getTime() - new Date(da).getTime();
  });

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground flex items-center justify-between">
          <span>
            Dokumente
            {documents.length > 0 && (
              <span className="ml-2 text-muted-foreground/70">· {documents.length}</span>
            )}
          </span>
          {onAdd && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAdd}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-1">
        {sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">Keine Dokumente</p>
        ) : (
          sorted.slice(0, 5).map((doc) => {
            const title = doc.document?.title || doc.document?.file_name || "Dokument";
            const ext = fileExt(doc.document?.file_name);
            const size = fileSize(doc.document?.file_size);
            const date = doc.document?.created_at ?? doc.created_at;
            return (
              <div
                key={doc.id}
                className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-b-0"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-tight">{title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {ext}
                    {size && <> · {size}</>}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 mt-1">
                  {format(new Date(date), "dd.MM.", { locale: de })}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
