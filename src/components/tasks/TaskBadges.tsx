import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PRIORITY_STYLES, STATUS_STYLES, STATUS_FALLBACK } from "@/lib/paletteStyles";

interface TaskBadgesProps {
  priority: string;
  status: string;
  category?: string;
  assignedTo?: string | null;
  assigneeName?: string;
  isHovered?: boolean;
  className?: string;
}

const formatStatusLabel = (status: string) =>
  status
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getStatusConfig = (status: string) => {
  const known = STATUS_STYLES[status as keyof typeof STATUS_STYLES];
  if (known) return { ...known, label: known.label };
  return { ...STATUS_FALLBACK, label: formatStatusLabel(status) };
};

export function TaskBadges({ 
  priority, 
  status, 
  category, 
  assignedTo, 
  assigneeName,
  isHovered = false,
  className 
}: TaskBadgesProps) {
  const priorityCfg = PRIORITY_STYLES[priority as keyof typeof PRIORITY_STYLES] || PRIORITY_STYLES.low;
  const statusCfg = getStatusConfig(status);


  // Small squares view (default)
  if (!isHovered) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <div className={cn("w-1.5 h-1.5 rounded-sm", priorityCfg.dot)} title={`Priorität: ${priorityCfg.label}`} />
        <div className={cn("w-1.5 h-1.5 rounded-sm", statusCfg.dot)} title={`Status: ${statusCfg.label}`} />
        {category && (
          <div className="w-1.5 h-1.5 rounded-sm bg-palette-violet" title={`Kategorie: ${category}`} />
        )}
        {assignedTo && (
          <div
            className="w-1.5 h-1.5 rounded-sm bg-palette-cyan"
            title={assigneeName ? `Zugewiesen an ${assigneeName}` : "Zugewiesen"}
          />
        )}
      </div>
    );
  }

  // Full badges view (on hover)
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs px-1.5 py-0 h-4 cursor-help",
                priorityCfg.text, 
                priorityCfg.border, 
                priorityCfg.bgLight
              )}
            >
              {priorityCfg.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Priorität</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs px-1.5 py-0 h-4 cursor-help",
                statusCfg.text, 
                statusCfg.border, 
                statusCfg.bgLight
              )}
            >
              {statusCfg.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Status</TooltipContent>
        </Tooltip>

        {category && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="text-xs px-1.5 py-0 h-4 cursor-help text-palette-violet border-palette-violet/40 bg-palette-violet/10"
              >
                {category}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Kategorie</TooltipContent>
          </Tooltip>
        )}

        {assignedTo && assigneeName && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="text-xs px-1.5 py-0 h-4 cursor-help text-palette-cyan border-palette-cyan/40 bg-palette-cyan/10"
              >
                {assigneeName.split(',')[0].trim().split(' ')[0]}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Zugewiesen an {assigneeName}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

