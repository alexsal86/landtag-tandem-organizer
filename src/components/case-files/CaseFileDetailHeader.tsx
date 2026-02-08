import { CaseFile } from "@/hooks/useCaseFiles";
import { CASE_STATUSES } from "@/hooks/useCaseFiles";
import { useCaseFileTypes } from "@/hooks/useCaseFileTypes";
import { icons, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  MoreVertical,
  Plus,
  Eye,
  EyeOff,
  Globe,
  Users,
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
  const { caseFileTypes } = useCaseFileTypes();
  const statusConfig = CASE_STATUSES.find((s) => s.value === caseFile.status);
  const typeConfig = caseFileTypes.find((t) => t.name === caseFile.case_type);

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || null;
  };

  const TypeIcon = getIconComponent(typeConfig?.icon);

  const visibilityConfig = {
    private: { icon: EyeOff, label: "Privat", variant: "secondary" as const },
    shared: { icon: Users, label: "Geteilt", variant: "outline" as const },
    public: { icon: Globe, label: "Öffentlich", variant: "outline" as const },
  };
  const visibility = visibilityConfig[caseFile.visibility as keyof typeof visibilityConfig] || visibilityConfig.public;
  const VisIcon = visibility.icon;

  return (
    <div className="space-y-3">
      {/* Top bar: Back + Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
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

      {/* Title + Badges */}
      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-white", statusConfig?.color || "bg-gray-500")}>
            {statusConfig?.label || caseFile.status}
          </Badge>
          <Badge
            variant="outline"
            style={{ borderColor: typeConfig?.color, color: typeConfig?.color }}
          >
            {TypeIcon && <TypeIcon className="h-3 w-3 mr-1" />}
            {typeConfig?.label || caseFile.case_type}
          </Badge>
          <Badge variant={visibility.variant}>
            <VisIcon className="h-3 w-3 mr-1" />
            {visibility.label}
          </Badge>
          {caseFile.priority && (
            <Badge variant="outline" className="text-xs">
              {caseFile.priority === "high"
                ? "🔴 Hoch"
                : caseFile.priority === "medium"
                ? "🟡 Mittel"
                : "🟢 Niedrig"}
            </Badge>
          )}
        </div>

        <div>
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

        {/* Quick-Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
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
      </div>
    </div>
  );
}
