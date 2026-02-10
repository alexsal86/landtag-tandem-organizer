import { CaseFile, CASE_STATUSES } from "@/hooks/useCaseFiles";
import { CaseFileType } from "@/hooks/useCaseFileTypes";
import { useCaseFileProcessingStatuses } from "@/hooks/useCaseFileProcessingStatuses";
import { useUserDisplay } from "@/hooks/useUserDisplay";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, FileText, CheckSquare, Calendar, Mail, Clock, Tag } from "lucide-react";
import { icons, LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CaseFileCardProps {
  caseFile: CaseFile;
  viewMode: "grid" | "list";
  onClick: () => void;
  caseFileTypes?: CaseFileType[];
}

export function CaseFileCard({ caseFile, viewMode, onClick, caseFileTypes = [] }: CaseFileCardProps) {
  const statusConfig = CASE_STATUSES.find(s => s.value === caseFile.status);
  const typeConfig = caseFileTypes.find(t => t.name === caseFile.case_type);
  const { statuses: processingStatuses } = useCaseFileProcessingStatuses();
  const { user: assignedUser } = useUserDisplay(caseFile.assigned_to);

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || null;
  };

  const TypeIcon = getIconComponent(typeConfig?.icon);

  const processingStatus = processingStatuses.find(
    (s) => s.name === (caseFile as any).processing_status
  );
  const ProcessingIcon = getIconComponent(processingStatus?.icon);

  const priorityColors: Record<string, string> = {
    low: "text-gray-500",
    medium: "text-blue-500",
    high: "text-orange-500",
    urgent: "text-red-500",
  };

  if (viewMode === "list") {
    return (
      <Card 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{caseFile.title}</h3>
                {caseFile.reference_number && (
                  <Badge variant="outline" className="text-xs">
                    {caseFile.reference_number}
                  </Badge>
                )}
              </div>
              {caseFile.description && (
                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                  {caseFile.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {assignedUser?.display_name && (
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={assignedUser.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {assignedUser.display_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{assignedUser.display_name}</span>
                </div>
              )}
              {processingStatus && (
                <Badge
                  style={{ backgroundColor: processingStatus.color || undefined, color: '#fff' }}
                >
                  {ProcessingIcon && <ProcessingIcon className="h-3 w-3 mr-1" />}
                  {processingStatus.label}
                </Badge>
              )}
              <Badge className={cn("text-white", statusConfig?.color || "bg-gray-500")}>
                {statusConfig?.label || caseFile.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{caseFile.title}</h3>
            {caseFile.reference_number && (
              <p className="text-xs text-muted-foreground">{caseFile.reference_number}</p>
            )}
          </div>
          <Badge className={cn("text-white shrink-0", statusConfig?.color || "bg-gray-500")}>
            {statusConfig?.label || caseFile.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {caseFile.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {caseFile.description}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {processingStatus && (
            <Badge
              style={{ backgroundColor: processingStatus.color || undefined, color: '#fff' }}
              className="text-xs"
            >
              {ProcessingIcon && <ProcessingIcon className="h-3 w-3 mr-1" />}
              {processingStatus.label}
            </Badge>
          )}
          <Badge 
            variant="outline"
            style={{ 
              borderColor: typeConfig?.color,
              color: typeConfig?.color
            }}
          >
            {TypeIcon && <TypeIcon className="h-3 w-3 mr-1" />}
            {typeConfig?.label || caseFile.case_type}
          </Badge>
          {caseFile.priority && caseFile.priority !== 'medium' && (
            <Badge variant="outline" className={priorityColors[caseFile.priority]}>
              {caseFile.priority === 'high' ? 'Hoch' : caseFile.priority === 'urgent' ? 'Dringend' : 'Niedrig'}
            </Badge>
          )}
        </div>

        {/* Assigned user */}
        {assignedUser?.display_name && (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={assignedUser.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">
                {assignedUser.display_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{assignedUser.display_name}</span>
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1" title="Kontakte">
            <Users className="h-4 w-4" />
            <span>{caseFile.contacts_count || 0}</span>
          </div>
          <div className="flex items-center gap-1" title="Dokumente">
            <FileText className="h-4 w-4" />
            <span>{caseFile.documents_count || 0}</span>
          </div>
          <div className="flex items-center gap-1" title="Aufgaben">
            <CheckSquare className="h-4 w-4" />
            <span>{caseFile.tasks_count || 0}</span>
          </div>
          <div className="flex items-center gap-1" title="Termine">
            <Calendar className="h-4 w-4" />
            <span>{caseFile.appointments_count || 0}</span>
          </div>
          <div className="flex items-center gap-1" title="Briefe">
            <Mail className="h-4 w-4" />
            <span>{caseFile.letters_count || 0}</span>
          </div>
        </div>

        {caseFile.tags && caseFile.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {caseFile.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {caseFile.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{caseFile.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Aktualisiert: {format(new Date(caseFile.updated_at), 'dd.MM.yyyy', { locale: de })}</span>
          </div>
          {caseFile.target_date && (
            <span>Ziel: {format(new Date(caseFile.target_date), 'dd.MM.yyyy', { locale: de })}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
