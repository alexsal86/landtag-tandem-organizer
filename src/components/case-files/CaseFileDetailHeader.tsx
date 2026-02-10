import { CaseFile } from "@/hooks/useCaseFiles";
import { CASE_STATUSES } from "@/hooks/useCaseFiles";
import { useCaseFileTypes } from "@/hooks/useCaseFileTypes";
import { useCaseFileProcessingStatuses } from "@/hooks/useCaseFileProcessingStatuses";
import { icons, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Edit2,
  Trash2,
  MoreVertical,
  StickyNote,
  CheckSquare,
  Calendar,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CaseFileDetailHeaderProps {
  caseFile: CaseFile;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddNote: () => void;
  onAddTask: () => void;
  onAddAppointment: () => void;
  onAddDocument: () => void;
}

export function CaseFileDetailHeader({
  caseFile,
  onBack,
  onEdit,
  onDelete,
  onAddNote,
  onAddTask,
  onAddAppointment,
  onAddDocument,
}: CaseFileDetailHeaderProps) {
  const statusConfig = CASE_STATUSES.find((s) => s.value === caseFile.status);
  const { statuses: processingStatuses } = useCaseFileProcessingStatuses();

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || null;
  };

  // Processing status badge
  const processingStatus = processingStatuses.find(
    (s) => s.name === (caseFile as any).processing_status
  );
  const ProcessingIcon = getIconComponent(processingStatus?.icon);

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      {/* Top: Title + Actions */}
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Bearbeiten
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bottom: Badges left, Quick actions right */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        {/* Quick-Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onAddNote}>
            <StickyNote className="mr-1.5 h-3.5 w-3.5" />
            Notiz
          </Button>
          <Button size="sm" variant="outline" onClick={onAddTask}>
            <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
            Aufgabe
          </Button>
          <Button size="sm" variant="outline" onClick={onAddAppointment}>
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            Termin
          </Button>
          <Button size="sm" variant="outline" onClick={onAddDocument}>
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Dokument
          </Button>
        </div>

        {/* Processing Status Badge only */}
        <div className="flex items-center gap-2 flex-wrap">
          {processingStatus && (
            <Badge
              style={{ backgroundColor: processingStatus.color || undefined, color: '#fff' }}
            >
              {ProcessingIcon && <ProcessingIcon className="h-3 w-3 mr-1" />}
              {processingStatus.label}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
