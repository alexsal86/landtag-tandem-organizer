import { CaseFile } from "@/features/cases/files/hooks";
import { CASE_STATUSES } from "@/features/cases/files/hooks";
import { useCaseFileTypes } from "@/features/cases/files/hooks";
import { useCaseFileProcessingStatuses } from "@/hooks/useCaseFileProcessingStatuses";
import { LucideIcon } from "lucide-react";
import { getLucideIcon } from "@/utils/iconUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore, Trash2, ArrowLeft, Pencil } from "lucide-react";
import type { CaseFileProcessingStatus } from "@/hooks/useCaseFileProcessingStatuses";

const toProcessingStatusNames = (caseFile: CaseFile): string[] => {
  if (Array.isArray(caseFile.processing_statuses)) {
    return caseFile.processing_statuses.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof caseFile.processing_status === "string" && caseFile.processing_status.length > 0) {
    return [caseFile.processing_status];
  }
  return [];
};

interface CaseFileDetailHeaderProps {
  caseFile: CaseFile;
  onBack: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onEdit: () => void;
}

export function CaseFileDetailHeader({
  caseFile,
  onBack,
  onDelete,
  onArchive,
  onEdit,
}: CaseFileDetailHeaderProps) {
  const statusConfig = CASE_STATUSES.find((s) => s.value === caseFile.status);
  const { statuses: processingStatuses } = useCaseFileProcessingStatuses();

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    return getLucideIcon(iconName);
  };

  const activeProcessingStatuses: CaseFileProcessingStatus[] = toProcessingStatusNames(caseFile)
    .map((name) => processingStatuses.find((status) => status.name === name))
    .filter((status): status is CaseFileProcessingStatus => Boolean(status));

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2 -mt-1 mb-1">
        <ArrowLeft className="h-4 w-4" />
        Zurück
      </Button>

      {/* Title + Status Badges + Delete Button */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">{caseFile.title}</h1>
          {caseFile.reference_number && (
            <p className="text-sm text-muted-foreground">
              Aktenzeichen: {caseFile.reference_number}
            </p>
          )}
          {caseFile.description && (
            <p className="text-sm text-muted-foreground mt-1">{caseFile.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Processing Status Badges */}
          {activeProcessingStatuses.map((ps) => {
            const PIcon = getIconComponent(ps?.icon);
            return (
              <Badge key={ps.name} style={{ backgroundColor: ps.color || undefined, color: '#fff' }}>
                {PIcon && <PIcon className="h-3 w-3 mr-1" />}
                {ps.label}
              </Badge>
            );
          })}
          <Button variant="outline" size="sm" onClick={onArchive}>
            {caseFile.status === "archived" ? <ArchiveRestore className="mr-1.5 h-4 w-4" /> : <Archive className="mr-1.5 h-4 w-4" />}
            {caseFile.status === "archived" ? "Wiederherstellen" : "Archivieren"}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Bearbeiten
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Löschen
          </Button>
        </div>
      </div>
    </div>
  );
}
