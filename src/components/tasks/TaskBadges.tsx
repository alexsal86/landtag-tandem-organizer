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
        <div className={cn("w-1.5 h-1.5 rounded-sm", priorityCfg.color)} title={`Priorität: ${priorityCfg.label}`} />
        <div className={cn("w-1.5 h-1.5 rounded-sm", statusCfg.color)} title={`Status: ${statusCfg.label}`} />
        {category && (
          <div className="w-1.5 h-1.5 rounded-sm bg-violet-500" title={`Kategorie: ${category}`} />
        )}
        {assignedTo && (
          <div
            className="w-1.5 h-1.5 rounded-sm bg-cyan-500"
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
                priorityCfg.textColor, 
                priorityCfg.borderColor, 
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
                statusCfg.textColor, 
                statusCfg.borderColor, 
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
                className="text-xs px-1.5 py-0 h-4 cursor-help text-violet-600 border-violet-300 bg-violet-50 dark:bg-violet-900/30"
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
                className="text-xs px-1.5 py-0 h-4 cursor-help text-cyan-600 border-cyan-300 bg-cyan-50 dark:bg-cyan-900/30"
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
